const DEFAULT_ORG_ID = 'org_fondation_ck';
const SESSION_TTL = 60 * 60 * 12;
const RATE_WINDOW = 60 * 15;
const LOGIN_MAX_ATTEMPTS = 6;
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_MAX_ITERATIONS = 100000;
const FOUNDATION_PHONE = '0757577542 / 0545202646';
const FOUNDATION_WHATSAPP = '';
const FOUNDATION_EMAIL = 'oukami011@gmail.com';
const encoder = new TextEncoder();

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) {
        await ensureRuntimeSecurityMigration(env);
        await ensureHierarchyVillageMigration(env);
        await ensureAccountRolesMigration(env);
        await ensureSuperAdmin(env, request);
        return await handleApi(request, env, ctx, url);
      }
      const assetResponse = await env.ASSETS.fetch(request);
      const headers = new Headers(assetResponse.headers);
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('X-Frame-Options', 'DENY');
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
      return new Response(assetResponse.body, { status: assetResponse.status, statusText: assetResponse.statusText, headers });
    } catch (error) {
      console.error('FCK Worker error', error);
      return json({ ok: false, error: error?.status ? (error.message || 'Requête invalide.') : 'Erreur serveur.' }, error?.status || 500);
    }
  }
};

async function handleApi(request, env, ctx, url) {
  const path = url.pathname;
  if (path === '/api/system-status' && request.method === 'GET') return systemStatus(env);
  if (path === '/api/public-home' && request.method === 'GET') return publicHome(env);
  if (path === '/api/news-detail' && request.method === 'GET') return publicNewsDetail(env, url);
  if (path === '/api/contact' && request.method === 'POST') return saveContact(request, env);
  if (path === '/api/register' && request.method === 'POST') return register(request, env);
  if (path === '/api/login' && request.method === 'POST') return login(request, env);
  if (path === '/api/password-reset-request' && request.method === 'POST') return requestPasswordReset(request, env);
  if (path.startsWith('/media/') && request.method === 'GET') return mediaGet(env, path.slice('/media/'.length));

  const session = await authenticate(request, env);
  if (!session) return json({ ok: false, error: 'Session invalide ou expirée.' }, 401);

  if (path === '/api/logout' && request.method === 'POST') return logout(request, env, session);
  if (path === '/api/load' && request.method === 'GET') return loadData(env, session, url);
  if (path === '/api/save' && request.method === 'POST') return saveData(request, env, session);
  if (path === '/api/upload-image' && request.method === 'POST') return uploadImage(request, env, session);
  if (path === '/api/superadmin') return superAdminApi(request, env, session, url);

  return json({ ok: false, error: 'Route introuvable.' }, 404);
}

async function ensureRuntimeSecurityMigration(env) {
  // Détecte un ancien schéma qui aurait placé password_hash dans users.
  // La requête dynamique évite de référencer une colonne absente sur les nouveaux déploiements.
  const key = 'migration:legacy-password-hash:v1';
  if (await env.FONDATIONCK_KV.get(key)) return;
  try {
    const info = await env.FONDATIONCK_DB.prepare('PRAGMA table_info(users)').all();
    const hasLegacy = (info.results || []).some(c => c.name === 'password_hash');
    if (hasLegacy) {
      await env.FONDATIONCK_DB.prepare(`
        INSERT OR REPLACE INTO credentials (user_id, password_hash, updated_at)
        SELECT id, password_hash, CURRENT_TIMESTAMP FROM users
        WHERE password_hash IS NOT NULL AND password_hash <> ''
      `).run();
      await env.FONDATIONCK_DB.prepare(`UPDATE users SET password_hash = NULL WHERE password_hash IS NOT NULL`).run();
    }
    await env.FONDATIONCK_KV.put(key, '1');
  } catch (e) {
    // Les migrations D1 peuvent ne pas encore être appliquées pendant le tout premier déploiement.
    console.warn('Legacy hash migration skipped:', e?.message || e);
  }
}


async function ensureHierarchyVillageMigration(env) {
  // V2.3 : ajoute sans intervention manuelle les colonnes nécessaires à la
  // hiérarchie Secteur > Localité > Village sur une base D1 déjà existante.
  const key = 'migration:hierarchy-village:v1';
  try { if (await env.FONDATIONCK_KV.get(key)) return; } catch {}
  const ensureColumn = async (table, column, ddl) => {
    const info = await env.FONDATIONCK_DB.prepare(`PRAGMA table_info(${table})`).all();
    if ((info.results || []).some(c => c.name === column)) return;
    try { await env.FONDATIONCK_DB.prepare(ddl).run(); }
    catch (e) {
      // Deux requêtes concurrentes peuvent tenter la même migration.
      if (!/duplicate column name/i.test(String(e?.message || e))) throw e;
    }
  };
  try {
    await ensureColumn('sectors', 'village', `ALTER TABLE sectors ADD COLUMN village TEXT DEFAULT ''`);
    await ensureColumn('responsibles', 'village', `ALTER TABLE responsibles ADD COLUMN village TEXT DEFAULT ''`);
    await env.FONDATIONCK_KV.put(key, '1');
  } catch (e) {
    console.warn('Hierarchy village migration pending:', e?.message || e);
  }
}


async function ensureAccountRolesMigration(env) {
  // V2.4 : les comptes créés librement deviennent Visiteurs. Les anciens
  // comptes auto-créés comme "admin" sont ramenés au statut Visiteur ; seuls
  // les Sous-administrateurs et l'Administrateur principal restent admin.
  const key = 'migration:account-roles:v2.4';
  try { if (await env.FONDATIONCK_KV.get(key)) return; } catch {}
  try {
    const rows = await env.FONDATIONCK_DB.prepare(`SELECT id,role,access_json FROM users WHERE role<>'superadmin'`).all();
    for (const row of (rows.results || [])) {
      let access = {}; try { access = JSON.parse(row.access_json || '{}') || {}; } catch {}
      const type = String(access.account_type || '');
      if (row.role === 'admin' && !['subadmin','principal_admin'].includes(type)) {
        await env.FONDATIONCK_DB.prepare(`UPDATE users SET role='member',access_json=?,session_version=session_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
          .bind(JSON.stringify(visitorAccess()), row.id).run();
      } else if (row.role === 'member' && !['visitor','agent'].includes(type)) {
        await env.FONDATIONCK_DB.prepare(`UPDATE users SET access_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
          .bind(JSON.stringify(agentAccess(access)), row.id).run();
      }
    }
    await env.FONDATIONCK_KV.put(key, '1');
  } catch (e) {
    console.warn('Account role migration pending:', e?.message || e);
  }
}

async function ensureSuperAdmin(env, request) {
  // Auto-réparation du Super Admin sur chaque appel API.
  // Aucun secret n'est renvoyé au navigateur ni stocké en clair dans D1.
  if (!env.FONDATIONCK_DB || !env.FONDATIONCK_KV) return { ok: false, reason: 'bindings_missing' };
  // Une fois le bootstrap confirmé, on évite plusieurs lectures/écritures D1 à chaque appel API.
  // Le login Super Admin conserve son mécanisme de resynchronisation si le secret change.
  try {
    const ready = await env.FONDATIONCK_KV.get('bootstrap:superadmin:v4');
    if (ready === '1') return { ok: true, cached: true };
  } catch {}
  if (!env.SUPERADMIN_EMAIL || !env.SUPERADMIN_PASSWORD) {
    try { await env.FONDATIONCK_KV.put('bootstrap:superadmin:status', 'missing_secrets', { expirationTtl: 3600 }); } catch {}
    return { ok: false, reason: 'missing_secrets' };
  }

  const email = normalizeEmail(env.SUPERADMIN_EMAIL);
  if (!validEmail(email)) {
    try { await env.FONDATIONCK_KV.put('bootstrap:superadmin:status', 'invalid_email', { expirationTtl: 3600 }); } catch {}
    return { ok: false, reason: 'invalid_email' };
  }

  const now = isoNow();
  const far = '2099-12-31T23:59:59.000Z';

  try {
    // Garantit l'organisation racine, même si une migration/initialisation a été partielle.
    await env.FONDATIONCK_DB.prepare(`
      INSERT INTO organizations (id, name, slug, status)
      VALUES (?, 'LA FONDATION CK', 'la-fondation-ck', 'active')
      ON CONFLICT(id) DO UPDATE SET status='active'
    `).bind(DEFAULT_ORG_ID).run();

    let user = await env.FONDATIONCK_DB.prepare(
      'SELECT id, role, status FROM users WHERE email = ? COLLATE NOCASE'
    ).bind(email).first();

    if (!user) {
      const id = crypto.randomUUID();
      await env.FONDATIONCK_DB.prepare(`
        INSERT INTO users (
          id, organization_id, email, full_name, phone, role, status, plan,
          plan_started_at, plan_expires_at, must_change_password, access_json, session_version
        ) VALUES (?, ?, ?, 'Super Admin', '', 'superadmin', 'active', 'business', ?, ?, 0, '{}', 1)
      `).bind(id, DEFAULT_ORG_ID, email, now, far).run();
      user = { id, role: 'superadmin', status: 'active' };
    } else {
      await env.FONDATIONCK_DB.prepare(`
        UPDATE users
        SET organization_id = ?, role = 'superadmin', status = 'active', plan = 'business',
            plan_started_at = CASE WHEN plan_started_at IS NULL OR plan_started_at = '' THEN ? ELSE plan_started_at END,
            plan_expires_at = ?, must_change_password = 0,
            access_json = '{}', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(DEFAULT_ORG_ID, now, far, user.id).run();
    }

    const credential = await env.FONDATIONCK_DB.prepare(
      'SELECT user_id FROM credentials WHERE user_id = ?'
    ).bind(user.id).first();

    // Le hash n'est généré que si les identifiants n'existent pas encore.
    // Si le secret est modifié plus tard dans Cloudflare, /api/login le resynchronise
    // uniquement lorsque la valeur secrète saisie correspond exactement au secret runtime.
    if (!credential) {
      const passwordHash = await hashPassword(String(env.SUPERADMIN_PASSWORD));
      await env.FONDATIONCK_DB.prepare(`
        INSERT INTO credentials (user_id, password_hash, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `).bind(user.id, passwordHash).run();
    }

    // Nettoyage du blocage par compte après bootstrap/réparation.
    try { await env.FONDATIONCK_KV.delete(`login:acct:${await sha256Hex(email)}`); } catch {}

    await audit(env, DEFAULT_ORG_ID, user.id, 'superadmin', 'BOOTSTRAP_SUPERADMIN', 'user', user.id, getIp(request), { configured: true });
    await env.FONDATIONCK_KV.put('bootstrap:superadmin:v4', '1');
    await env.FONDATIONCK_KV.put('bootstrap:superadmin:status', 'ready');
    await env.FONDATIONCK_KV.delete('bootstrap:superadmin:error');
    return { ok: true, user_id: user.id };
  } catch (e) {
    const message = clean(e?.message || String(e), 500);
    console.warn('Superadmin bootstrap pending:', message);
    try {
      await env.FONDATIONCK_KV.put('bootstrap:superadmin:status', 'error', { expirationTtl: 3600 });
      await env.FONDATIONCK_KV.put('bootstrap:superadmin:error', message, { expirationTtl: 3600 });
    } catch {}
    return { ok: false, reason: 'database_error' };
  }
}

async function systemStatus(env) {
  const status = {
    ok: true,
    database_binding: !!env.FONDATIONCK_DB,
    kv_binding: !!env.FONDATIONCK_KV,
    superadmin_email_configured: !!env.SUPERADMIN_EMAIL,
    superadmin_password_configured: !!env.SUPERADMIN_PASSWORD,
    organization_exists: false,
    superadmin_exists: false,
    superadmin_credential_exists: false
  };
  if (!env.FONDATIONCK_DB) return json(status);
  try {
    const org = await env.FONDATIONCK_DB.prepare('SELECT id FROM organizations WHERE id=?').bind(DEFAULT_ORG_ID).first();
    status.organization_exists = !!org;
    if (env.SUPERADMIN_EMAIL) {
      const email = normalizeEmail(env.SUPERADMIN_EMAIL);
      const user = await env.FONDATIONCK_DB.prepare(`
        SELECT u.id, c.user_id AS credential_user_id
        FROM users u LEFT JOIN credentials c ON c.user_id=u.id
        WHERE u.email=? COLLATE NOCASE AND u.role='superadmin'
      `).bind(email).first();
      status.superadmin_exists = !!user;
      status.superadmin_credential_exists = !!user?.credential_user_id;
    }
  } catch (e) {
    status.ok = false;
    status.database_error = true;
  }
  return json(status);
}

async function publicHome(env) {
  const [contentRow, news] = await Promise.all([
    env.FONDATIONCK_DB.prepare('SELECT * FROM site_content WHERE organization_id = ?').bind(DEFAULT_ORG_ID).first(),
    env.FONDATIONCK_DB.prepare(`
      SELECT id, title, summary, image_key, published_at
      FROM news WHERE organization_id = ? AND published = 1
      ORDER BY datetime(published_at) DESC LIMIT 12
    `).bind(DEFAULT_ORG_ID).all()
  ]);
  const content = { ...(contentRow || {}) };
  if (!clean(content.contact_phone, 80)) content.contact_phone = FOUNDATION_PHONE;
  if (!clean(content.whatsapp, 80)) content.whatsapp = FOUNDATION_WHATSAPP;
  if (!clean(content.contact_email, 180)) content.contact_email = FOUNDATION_EMAIL;
  if (!clean(content.address, 500)) content.address = 'Côte d’Ivoire';
  return json({ ok: true, content, news: (news.results || []).map(n => ({ ...n, image_url: n.image_key ? `/media/${encodeURIComponent(n.image_key)}` : '' })) }, 200, { 'Cache-Control': 'public, max-age=10, stale-while-revalidate=30' });
}

async function publicNewsDetail(env, url) {
  const id = clean(url.searchParams.get('id'), 80);
  if (!id) return json({ ok: false, error: 'Actualité introuvable.' }, 404);
  const item = await env.FONDATIONCK_DB.prepare(`
    SELECT id, title, summary, content, image_key, published_at
    FROM news WHERE id = ? AND organization_id = ? AND published = 1
  `).bind(id, DEFAULT_ORG_ID).first();
  if (!item) return json({ ok: false, error: 'Actualité introuvable.' }, 404);
  item.image_url = item.image_key ? `/media/${encodeURIComponent(item.image_key)}` : '';
  return json({ ok: true, item }, 200, { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' });
}

async function saveContact(request, env) {
  const ip = getIp(request);
  if (await limited(env, `contact:${await sha256Hex(ip)}`, 10, 3600)) return json({ ok: false, error: 'Trop de messages. Réessayez plus tard.' }, 429);
  const body = await safeJson(request);
  const name = clean(body.name, 120);
  const message = clean(body.message, 3000);
  if (!name || !message) return json({ ok: false, error: 'Nom et message requis.' }, 400);
  await env.FONDATIONCK_DB.prepare(`
    INSERT INTO contact_messages (id, organization_id, name, email, phone, subject, message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), DEFAULT_ORG_ID, name, clean(body.email, 180), clean(body.phone, 40), clean(body.subject, 180), message).run();
  return json({ ok: true, message: 'Votre message a bien été enregistré.' });
}

async function register(request, env) {
  const ip = getIp(request);
  if (await limited(env, `register:${await sha256Hex(ip)}`, 5, 3600)) return json({ ok: false, error: 'Trop de créations de compte. Réessayez plus tard.' }, 429);
  const body = await safeJson(request);
  const email = normalizeEmail(body.email);
  const fullName = clean(body.full_name, 140);
  const phone = clean(body.phone, 40);
  const password = String(body.password || '');
  if (!validEmail(email) || !fullName || password.length < 8) return json({ ok: false, error: 'Nom, e-mail valide et mot de passe de 8 caractères minimum requis.' }, 400);
  const exists = await env.FONDATIONCK_DB.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').bind(email).first();
  if (exists) return json({ ok: false, error: 'Un compte existe déjà avec cet e-mail.' }, 409);
  const id = crypto.randomUUID();
  const start = isoNow();
  const expiry = addDays(start, 10);
  const access = JSON.stringify(visitorAccess());
  await env.FONDATIONCK_DB.batch([
    env.FONDATIONCK_DB.prepare(`
      INSERT INTO users (id, organization_id, email, full_name, phone, role, status, plan, plan_started_at, plan_expires_at, access_json)
      VALUES (?, ?, ?, ?, ?, 'member', 'active', 'free', ?, ?, ?)
    `).bind(id, DEFAULT_ORG_ID, email, fullName, phone, start, expiry, access),
    env.FONDATIONCK_DB.prepare('INSERT INTO credentials (user_id, password_hash) VALUES (?, ?)').bind(id, await hashPassword(password))
  ]);
  await audit(env, DEFAULT_ORG_ID, id, 'member', 'REGISTER_VISITOR_ACCOUNT', 'user', id, ip, { email });
  return json({ ok: true, message: 'Compte créé avec le statut Visiteur. Un Administrateur principal pourra ensuite vous attribuer le statut Agent ou Sous-administrateur.' }, 201);
}

async function login(request, env) {
  const body = await safeJson(request);
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const ip = getIp(request);
  const ipKey = `login:ip:${await sha256Hex(ip)}`;
  const acctKey = `login:acct:${await sha256Hex(email)}`;
  const [ipBlocked, acctBlocked] = await Promise.all([
    isLoginBlocked(env, ipKey), isLoginBlocked(env, acctKey)
  ]);
  if (ipBlocked || acctBlocked) return json({ ok: false, error: 'Trop de tentatives. Connexion bloquée pendant 15 minutes.' }, 429);

  let user = await env.FONDATIONCK_DB.prepare(`
    SELECT u.*, c.password_hash, o.status AS organization_status
    FROM users u LEFT JOIN credentials c ON c.user_id = u.id
    LEFT JOIN organizations o ON o.id = u.organization_id
    WHERE u.email = ? COLLATE NOCASE
  `).bind(email).first();

  // Correctif V2 : si le compte Super Admin n'existe pas encore mais que
  // l'identifiant/mot de passe saisis correspondent aux secrets Cloudflare,
  // on déclenche immédiatement son bootstrap serveur puis on recharge le compte.
  const matchesRuntimeSuperAdmin = !!(
    env.SUPERADMIN_EMAIL && env.SUPERADMIN_PASSWORD &&
    email === normalizeEmail(env.SUPERADMIN_EMAIL) &&
    password === String(env.SUPERADMIN_PASSWORD)
  );
  if (!user && matchesRuntimeSuperAdmin) {
    await ensureSuperAdmin(env, request);
    user = await env.FONDATIONCK_DB.prepare(`
      SELECT u.*, c.password_hash, o.status AS organization_status
      FROM users u LEFT JOIN credentials c ON c.user_id = u.id
      LEFT JOIN organizations o ON o.id = u.organization_id
      WHERE u.email = ? COLLATE NOCASE
    `).bind(email).first();
  }

  let valid = user && user.password_hash && await verifyPassword(password, user.password_hash);
  if (!valid && user?.role === 'superadmin' && matchesRuntimeSuperAdmin) {
    const repairedHash = await hashPassword(password);
    await env.FONDATIONCK_DB.prepare(`
      INSERT INTO credentials (user_id, password_hash, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET password_hash = excluded.password_hash, updated_at = CURRENT_TIMESTAMP
    `).bind(user.id, repairedHash).run();
    user.password_hash = repairedHash;
    valid = true;
  }
  if (!valid) {
    await Promise.all([bumpLogin(env, ipKey), bumpLogin(env, acctKey)]);
    return json({ ok: false, error: 'Identifiants incorrects.' }, 401);
  }
  if (user.status !== 'active' || (user.role !== 'superadmin' && user.organization_status !== 'active')) {
    await audit(env, user.organization_id, user.id, user.role, 'LOGIN_BLOCKED_DISABLED', 'user', user.id, ip, {});
    return json({ ok: false, error: 'Ce compte est désactivé.' }, 403);
  }

  await Promise.all([env.FONDATIONCK_KV.delete(ipKey), env.FONDATIONCK_KV.delete(acctKey)]);
  const token = randomToken(32);
  const csrf = randomToken(24);
  const session = { user_id: user.id, organization_id: user.organization_id, role: user.role, session_version: user.session_version, csrf, created_at: isoNow() };
  await env.FONDATIONCK_KV.put(`session:${token}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
  await audit(env, user.organization_id, user.id, user.role, 'LOGIN_SUCCESS', 'session', '', ip, {});
  const responseUser = sanitizeUser(user);
  return json({ ok: true, user: responseUser, csrf_token: csrf, subscription_active: isSubscriptionActive(user) }, 200, {
    'Set-Cookie': sessionCookie(token)
  });
}

async function requestPasswordReset(request, env) {
  const body = await safeJson(request);
  const email = normalizeEmail(body.email);
  const ip = getIp(request);
  if (!validEmail(email)) return json({ ok: false, error: 'E-mail invalide.' }, 400);
  if (await limited(env, `resetreq:${await sha256Hex(ip + '|' + email)}`, 4, 3600)) return json({ ok: false, error: 'Trop de demandes. Réessayez plus tard.' }, 429);
  const user = await env.FONDATIONCK_DB.prepare('SELECT id, organization_id, role FROM users WHERE email = ? COLLATE NOCASE').bind(email).first();
  // Réponse volontairement neutre pour éviter l’énumération des comptes.
  if (user) {
    const pending = await env.FONDATIONCK_DB.prepare(`SELECT id FROM password_reset_requests WHERE user_id = ? AND status='pending'`).bind(user.id).first();
    if (!pending) {
      await env.FONDATIONCK_DB.prepare(`
        INSERT INTO password_reset_requests (id, organization_id, user_id, email, target_role)
        VALUES (?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), user.organization_id, user.id, email, user.role).run();
    }
  }
  return json({ ok: true, message: 'Demande enregistrée. L’Administrateur principal et les Sous-administrateurs sont réinitialisés par le Super Admin ; les Visiteurs et Agents sont réinitialisés par un administrateur.' });
}

async function logout(request, env, session) {
  if (!validCsrf(request, session)) return json({ ok: false, error: 'Jeton CSRF invalide.' }, 403);
  const token = cookieValue(request, 'fck_session');
  if (token) await env.FONDATIONCK_KV.delete(`session:${token}`);
  return json({ ok: true }, 200, { 'Set-Cookie': expiredCookie() });
}

async function authenticate(request, env) {
  const token = cookieValue(request, 'fck_session');
  if (!token) return null;
  const raw = await env.FONDATIONCK_KV.get(`session:${token}`);
  if (!raw) return null;
  let session;
  try { session = JSON.parse(raw); } catch { return null; }
  const user = await env.FONDATIONCK_DB.prepare(`
    SELECT u.*, o.status AS organization_status
    FROM users u LEFT JOIN organizations o ON o.id = u.organization_id
    WHERE u.id = ?
  `).bind(session.user_id).first();
  if (!user || user.status !== 'active' || user.session_version !== session.session_version) {
    await env.FONDATIONCK_KV.delete(`session:${token}`);
    return null;
  }
  if (user.role !== 'superadmin' && user.organization_status !== 'active') return null;
  return { ...session, user };
}

async function loadData(env, session, url) {
  const user = session.user;
  const orgId = user.role === 'superadmin' ? DEFAULT_ORG_ID : user.organization_id;
  const access = parseAccess(user.access_json, user.role);
  const subscriptionActive = isSubscriptionActive(user);
  const scope = clean(url?.searchParams?.get('scope') || 'session', 30);
  const payload = {
    ok: true, user: sanitizeUser(user), csrf_token: session.csrf, access,
    subscription_active: subscriptionActive, plan: planInfo(user),
    content: {}, sectors: [], responsibles: [], girls: [], boys: [], news: [], users: [], reset_requests: [], contact_messages: [], report: { totals: {}, by_sector: [] }
  };
  if (!subscriptionActive && user.role !== 'superadmin') return json(payload);
  if (scope === 'session') return json(payload);

  const jobs = [];
  const assign = [];
  const add = (name, promise) => { assign.push(name); jobs.push(promise); };
  if (scope === 'sectors' && access.sectors) add('sectors', env.FONDATIONCK_DB.prepare('SELECT * FROM sectors WHERE organization_id = ? ORDER BY name, locality, village').bind(orgId).all());
  if (scope === 'responsibles' && access.responsibles) {
    add('sectors', env.FONDATIONCK_DB.prepare('SELECT * FROM sectors WHERE organization_id = ? ORDER BY name, locality, village').bind(orgId).all());
    add('responsibles', env.FONDATIONCK_DB.prepare(`SELECT r.*, s.name AS sector_name FROM responsibles r LEFT JOIN sectors s ON s.id=r.sector_id WHERE r.organization_id=? ORDER BY r.full_name`).bind(orgId).all());
  }
  if (scope === 'girls' && access.girls) {
    add('sectors', env.FONDATIONCK_DB.prepare('SELECT * FROM sectors WHERE organization_id = ? ORDER BY name, locality, village').bind(orgId).all());
    add('girls', env.FONDATIONCK_DB.prepare(`SELECT g.*, s.name AS sector_name FROM girls g LEFT JOIN sectors s ON s.id=g.sector_id WHERE g.organization_id=? ORDER BY g.full_name`).bind(orgId).all());
  }
  if (scope === 'boys' && access.boys) {
    add('sectors', env.FONDATIONCK_DB.prepare('SELECT * FROM sectors WHERE organization_id = ? ORDER BY name, locality, village').bind(orgId).all());
    add('boys', env.FONDATIONCK_DB.prepare(`SELECT b.*, s.name AS sector_name FROM boys b LEFT JOIN sectors s ON s.id=b.sector_id WHERE b.organization_id=? ORDER BY b.full_name`).bind(orgId).all());
  }
  if (scope === 'report' && access.reports) {
    add('report_totals', env.FONDATIONCK_DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM sectors WHERE organization_id=?) AS sectors,
        (SELECT COUNT(*) FROM responsibles WHERE organization_id=?) AS responsibles,
        (SELECT COUNT(*) FROM girls WHERE organization_id=?) AS girls,
        (SELECT COUNT(*) FROM boys WHERE organization_id=?) AS boys
    `).bind(orgId,orgId,orgId,orgId).first());
    add('report_by_sector', env.FONDATIONCK_DB.prepare(`
      SELECT s.id,s.name,s.locality,s.village,
        (SELECT COUNT(*) FROM responsibles r WHERE r.organization_id=? AND r.sector_id=s.id) AS responsibles,
        (SELECT COUNT(*) FROM girls g WHERE g.organization_id=? AND g.sector_id=s.id) AS girls,
        (SELECT COUNT(*) FROM boys b WHERE b.organization_id=? AND b.sector_id=s.id) AS boys
      FROM sectors s WHERE s.organization_id=?
      ORDER BY s.name,s.locality,s.village
    `).bind(orgId,orgId,orgId,orgId).all());
  }
  if (scope === 'settings' && ['admin','superadmin'].includes(user.role)) {
    add('content', env.FONDATIONCK_DB.prepare('SELECT * FROM site_content WHERE organization_id = ?').bind(orgId).first());
    add('news', env.FONDATIONCK_DB.prepare('SELECT id,title,summary,content,image_key,published,published_at,created_at FROM news WHERE organization_id=? ORDER BY datetime(published_at) DESC').bind(orgId).all());
    add('users', env.FONDATIONCK_DB.prepare(`SELECT id,email,full_name,phone,role,status,plan,plan_started_at,plan_expires_at,must_change_password,access_json,created_at FROM users WHERE organization_id=? ORDER BY role, full_name`).bind(orgId).all());
    add('reset_requests', env.FONDATIONCK_DB.prepare(`SELECT r.id,r.email,r.target_role,r.status,r.requested_at,u.full_name FROM password_reset_requests r LEFT JOIN users u ON u.id=r.user_id WHERE r.organization_id=? AND r.status='pending' AND r.target_role='member' ORDER BY datetime(r.requested_at) DESC`).bind(orgId).all());
    add('contact_messages', env.FONDATIONCK_DB.prepare('SELECT * FROM contact_messages WHERE organization_id=? ORDER BY datetime(created_at) DESC LIMIT 100').bind(orgId).all());
  }
  const results = await Promise.all(jobs);
  for (let i=0;i<results.length;i++) {
    const name=assign[i], value=results[i];
    if (name==='content') payload.content=value||{};
    else if (name==='report_totals') payload.report.totals=value||{};
    else if (name==='report_by_sector') payload.report.by_sector=value.results||[];
    else if (name==='users') payload.users=(value.results||[]).map(sanitizeUser);
    else if (name==='news') payload.news=(value.results||[]).map(n=>({...n,image_url:n.image_key?`/media/${encodeURIComponent(n.image_key)}`:''}));
    else payload[name]=value.results||[];
  }
  if (scope === 'settings') {
    if (!clean(payload.content.contact_phone,80)) payload.content.contact_phone=FOUNDATION_PHONE;
    if (!clean(payload.content.whatsapp,80)) payload.content.whatsapp=FOUNDATION_WHATSAPP;
    if (!clean(payload.content.contact_email,180)) payload.content.contact_email=FOUNDATION_EMAIL;
    if (!clean(payload.content.address,500)) payload.content.address='Côte d’Ivoire';
  }
  return json(payload);
}

async function saveData(request, env, session) {
  if (!validCsrf(request, session)) return json({ ok: false, error: 'Jeton CSRF invalide.' }, 403);
  const body = await safeJson(request);
  const action = clean(body.action, 80);
  const user = session.user;
  const orgId = user.role === 'superadmin' ? DEFAULT_ORG_ID : user.organization_id;
  const currentType = accountType(user);
  if (currentType === 'visitor' && action !== 'change-own-password') return json({ ok: false, error: 'Le statut Visiteur autorise uniquement la consultation. Aucune modification n’est permise.' }, 403);
  if (!isSubscriptionActive(user) && user.role !== 'superadmin' && !['change-own-password'].includes(action)) {
    return json({ ok: false, error: 'Votre abonnement a expiré. Activez un plan pour continuer.' }, 402);
  }

  const strictAdmin = new Set(['add-news','update-news','delete-news','update-site-content','create-user','update-user-access','reset-member-password','resolve-member-reset']);
  const entityPage = {
    'add-sector':'sectors','update-sector':'sectors','delete-sector':'sectors',
    'add-responsible':'responsibles','update-responsible':'responsibles','delete-responsible':'responsibles',
    'add-girl':'girls','update-girl':'girls','delete-girl':'girls',
    'add-boy':'boys','update-boy':'boys','delete-boy':'boys'
  };
  const addActions = new Set(['add-sector','add-responsible','add-girl','add-boy']);
  const guardedAgentActions = new Set(['update-sector','delete-sector','update-responsible','delete-responsible','update-girl','delete-girl','update-boy','delete-boy']);
  if (strictAdmin.has(action) && !['admin','superadmin'].includes(user.role)) return json({ ok: false, error: 'Action réservée à l’Administrateur.' }, 403);
  if (action === 'set-user-type' && !isPrincipalAdmin(user)) return json({ ok: false, error: 'Seul l’Administrateur principal peut attribuer le statut Agent ou Sous-administrateur.' }, 403);
  let approvalAdminId = '';
  if (user.role === 'member' && currentType === 'agent' && action !== 'change-own-password') {
    const memberAccess = parseAccess(user.access_json, user.role);
    const pageKey = entityPage[action];
    if (!pageKey || !memberAccess[pageKey]) return json({ ok: false, error: 'Action non autorisée pour cet Agent.' }, 403);
    if (addActions.has(action) && memberAccess.can_add === false) return json({ ok: false, error: 'Votre Administrateur n’a pas autorisé l’ajout de lignes.' }, 403);
    if (guardedAgentActions.has(action)) {
      const approved = await verifyAdminApproval(env, user, body.admin_password, request);
      if (!approved.ok) return json({ ok: false, error: approved.error }, approved.status || 403);
      approvalAdminId = approved.admin_id || '';
    }
  }

  let result;
  switch (action) {
    case 'add-sector': result = await addSector(env, orgId, body); break;
    case 'update-sector': result = await updateSector(env, orgId, body); break;
    case 'delete-sector': result = await deleteEntity(env, 'sectors', orgId, body.id); break;
    case 'add-responsible': result = await addResponsible(env, orgId, body); break;
    case 'update-responsible': result = await updateResponsible(env, orgId, body); break;
    case 'delete-responsible': result = await deleteEntity(env, 'responsibles', orgId, body.id); break;
    case 'add-girl': result = await addYoung(env, 'girls', orgId, body); break;
    case 'update-girl': result = await updateYoung(env, 'girls', orgId, body); break;
    case 'delete-girl': result = await deleteEntity(env, 'girls', orgId, body.id); break;
    case 'add-boy': result = await addYoung(env, 'boys', orgId, body); break;
    case 'update-boy': result = await updateYoung(env, 'boys', orgId, body); break;
    case 'delete-boy': result = await deleteEntity(env, 'boys', orgId, body.id); break;
    case 'add-news': result = await addNews(env, orgId, user.id, body); break;
    case 'update-news': result = await updateNews(env, orgId, body); break;
    case 'delete-news': result = await deleteNews(env, orgId, body.id); break;
    case 'update-site-content': result = await updateSiteContent(env, orgId, body); break;
    case 'create-user': result = await createMember(env, orgId, body, user); break;
    case 'set-user-type': result = await setUserTypeByPrincipal(env, orgId, body, user); break;
    case 'update-user-access': result = await updateMemberAccess(env, orgId, body); break;
    case 'reset-member-password': result = await resetMemberPassword(env, orgId, body); break;
    case 'resolve-member-reset': result = await resolveMemberReset(env, orgId, body, user.id); break;
    case 'change-own-password': result = await changeOwnPassword(env, user, body); break;
    default: return json({ ok: false, error: 'Action non autorisée.' }, 400);
  }
  await audit(env, orgId, user.id, user.role, `SAVE_${action.toUpperCase()}`, result?.target_type || '', result?.target_id || '', getIp(request), { ...(result?.audit || {}), ...(approvalAdminId ? { approval_admin_id: approvalAdminId } : {}) });
  return json({ ok: true, ...(result || {}) });
}

async function uploadImage(request, env, session) {
  if (!validCsrf(request, session)) return json({ ok: false, error: 'Jeton CSRF invalide.' }, 403);
  if (!['admin','superadmin'].includes(session.user.role)) return json({ ok: false, error: 'Action réservée à l’administrateur.' }, 403);
  const form = await request.formData();
  const file = form.get('image');
  if (!(file instanceof File) || file.size === 0) return json({ ok: false, error: 'Image requise.' }, 400);
  if (file.size > 5 * 1024 * 1024) return json({ ok: false, error: 'Image trop volumineuse (5 Mo max).' }, 413);
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return json({ ok: false, error: 'Format autorisé : JPG, PNG ou WEBP.' }, 415);
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const orgId = session.user.role === 'superadmin' ? DEFAULT_ORG_ID : session.user.organization_id;
  const key = `news/${orgId}/${crypto.randomUUID()}.${ext}`;
  await env.FONDATIONCK_KV.put(`media:${key}`, await file.arrayBuffer(), { metadata: { contentType: file.type, uploadedBy: session.user.id } });
  await audit(env, orgId, session.user.id, session.user.role, 'UPLOAD_NEWS_IMAGE', 'media', key, getIp(request), { size: file.size, type: file.type });
  return json({ ok: true, key, url: `/media/${encodeURIComponent(key)}` });
}

async function mediaGet(env, encodedKey) {
  const key = decodeURIComponent(encodedKey);
  if (!key.startsWith('news/')) return new Response('Not found', { status: 404 });
  const found = await env.FONDATIONCK_KV.getWithMetadata(`media:${key}`, { type: 'arrayBuffer' });
  if (!found.value) return new Response('Not found', { status: 404 });
  return new Response(found.value, {
    headers: {
      'Content-Type': found.metadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

async function superAdminApi(request, env, session, url) {
  if (session.user.role !== 'superadmin') return json({ ok: false, error: 'Accès Super Admin requis.' }, 403);
  if (request.method === 'GET') {
    const users = await env.FONDATIONCK_DB.prepare(`
      SELECT u.id,u.organization_id,u.email,u.full_name,u.phone,u.role,u.status,u.plan,u.plan_started_at,u.plan_expires_at,u.must_change_password,u.access_json,u.created_at,o.name AS organization_name
      FROM users u LEFT JOIN organizations o ON o.id=u.organization_id
      ORDER BY CASE u.role WHEN 'superadmin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.full_name
    `).all();
    const resets = await env.FONDATIONCK_DB.prepare(`
      SELECT r.id,r.organization_id,r.user_id,r.email,r.target_role,r.status,r.requested_at,u.full_name
      FROM password_reset_requests r LEFT JOIN users u ON u.id=r.user_id
      WHERE r.status='pending' ORDER BY datetime(r.requested_at) DESC LIMIT 200
    `).all();
    const logs = await env.FONDATIONCK_DB.prepare(`SELECT * FROM audit_log ORDER BY id DESC LIMIT 200`).all();
    const counts = await env.FONDATIONCK_DB.prepare(`SELECT role,status,COUNT(*) AS total FROM users GROUP BY role,status`).all();
    return json({ ok: true, csrf_token: session.csrf, user: sanitizeUser(session.user), users: (users.results || []).map(sanitizeUser), reset_requests: resets.results || [], audit: logs.results || [], counts: counts.results || [] });
  }
  if (request.method !== 'POST') return json({ ok: false, error: 'Méthode non autorisée.' }, 405);
  if (!validCsrf(request, session)) return json({ ok: false, error: 'Jeton CSRF invalide.' }, 403);
  const body = await safeJson(request);
  const action = clean(body.action, 80);
  let result;
  if (action === 'set-status') result = await superSetStatus(env, session.user.id, body);
  else if (action === 'delete-user') result = await superDeleteUser(env, session.user.id, body);
  else if (action === 'set-plan') result = await superSetPlan(env, body);
  else if (action === 'reset-password') result = await superResetPassword(env, body);
  else if (action === 'resolve-reset') result = await superResolveReset(env, body, session.user.id);
  else if (action === 'update-access') result = await superUpdateAccess(env, body);
  else if (action === 'set-account-type') result = await superSetAccountType(env, body);
  else return json({ ok: false, error: 'Action Super Admin inconnue.' }, 400);
  await audit(env, result?.organization_id || null, session.user.id, 'superadmin', `SUPER_${action.toUpperCase()}`, result?.target_type || 'user', result?.target_id || '', getIp(request), result?.audit || {});
  return json({ ok: true, ...(result || {}) });
}

async function addSector(env, orgId, b) {
  const id = crypto.randomUUID();
  const name = clean(b.name, 140); if (!name) throw bad('Nom du secteur requis.');
  await env.FONDATIONCK_DB.prepare('INSERT INTO sectors (id,organization_id,name,locality,village,description) VALUES (?,?,?,?,?,?)').bind(id, orgId, name, clean(b.locality,140), clean(b.village,140), clean(b.description,1000)).run();
  return { target_type:'sector', target_id:id };
}
async function updateSector(env, orgId, b) {
  const id=clean(b.id,80), name=clean(b.name,140); if(!id||!name) throw bad('Données incomplètes.');
  const r=await env.FONDATIONCK_DB.prepare(`UPDATE sectors SET name=?,locality=?,village=?,description=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?`).bind(name,clean(b.locality,140),clean(b.village,140),clean(b.description,1000),id,orgId).run();
  ensureChanged(r); return { target_type:'sector', target_id:id };
}
async function addResponsible(env, orgId, b) {
  const id=crypto.randomUUID(), full=clean(b.full_name,140); if(!full) throw bad('Nom requis.');
  const sector = await sectorContext(env, orgId, b.sector_id);
  const sectorId = sector?.id || null;
  const locality = sector ? clean(sector.locality,140) : clean(b.locality,140);
  const village = sector ? clean(sector.village,140) : clean(b.village,140);
  await env.FONDATIONCK_DB.prepare(`INSERT INTO responsibles (id,organization_id,sector_id,full_name,function_title,phone,email,locality,village) VALUES (?,?,?,?,?,?,?,?,?)`).bind(id,orgId,sectorId,full,clean(b.function_title,140)||'Responsable de secteur',clean(b.phone,40),clean(b.email,180),locality,village).run();
  return { target_type:'responsible', target_id:id };
}
async function updateResponsible(env, orgId, b) {
  const id=clean(b.id,80), full=clean(b.full_name,140); if(!id||!full) throw bad('Données incomplètes.');
  const sector = await sectorContext(env, orgId, b.sector_id);
  const sectorId = sector?.id || null;
  const locality = sector ? clean(sector.locality,140) : clean(b.locality,140);
  const village = sector ? clean(sector.village,140) : clean(b.village,140);
  const r=await env.FONDATIONCK_DB.prepare(`UPDATE responsibles SET sector_id=?,full_name=?,function_title=?,phone=?,email=?,locality=?,village=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?`).bind(sectorId,full,clean(b.function_title,140)||'Responsable de secteur',clean(b.phone,40),clean(b.email,180),locality,village,id,orgId).run(); ensureChanged(r);
  return { target_type:'responsible', target_id:id };
}
async function addYoung(env, table, orgId, b) {
  const id=crypto.randomUUID(), full=clean(b.full_name,140); if(!full) throw bad('Nom requis.');
  const sectorId=await validSector(env,orgId,b.sector_id);
  await env.FONDATIONCK_DB.prepare(`INSERT INTO ${table} (id,organization_id,sector_id,full_name,birth_date,phone,locality,occupation,status_label) VALUES (?,?,?,?,?,?,?,?,?)`).bind(id,orgId,sectorId,full,clean(b.birth_date,20),clean(b.phone,40),clean(b.locality,140),clean(b.occupation,180),clean(b.status_label,80)||'Actif').run();
  return { target_type: table, target_id:id };
}
async function updateYoung(env, table, orgId, b) {
  const id=clean(b.id,80), full=clean(b.full_name,140); if(!id||!full) throw bad('Données incomplètes.');
  const sectorId=await validSector(env,orgId,b.sector_id);
  const r=await env.FONDATIONCK_DB.prepare(`UPDATE ${table} SET sector_id=?,full_name=?,birth_date=?,phone=?,locality=?,occupation=?,status_label=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?`).bind(sectorId,full,clean(b.birth_date,20),clean(b.phone,40),clean(b.locality,140),clean(b.occupation,180),clean(b.status_label,80)||'Actif',id,orgId).run(); ensureChanged(r);
  return { target_type: table, target_id:id };
}
async function deleteEntity(env, table, orgId, rawId) {
  const allowed = new Set(['sectors','responsibles','girls','boys']); if(!allowed.has(table)) throw bad('Table interdite.');
  const id=clean(rawId,80); if(!id) throw bad('Identifiant manquant.');
  const r=await env.FONDATIONCK_DB.prepare(`DELETE FROM ${table} WHERE id=? AND organization_id=?`).bind(id,orgId).run(); ensureChanged(r);
  return { target_type:table, target_id:id };
}
async function addNews(env, orgId, actorId, b) {
  const id=crypto.randomUUID(), title=clean(b.title,180), content=clean(b.content,12000); if(!title||!content) throw bad('Titre et contenu requis.');
  const published = b.published === false ? 0 : 1;
  await env.FONDATIONCK_DB.prepare(`INSERT INTO news (id,organization_id,title,summary,content,image_key,published,published_at,created_by) VALUES (?,?,?,?,?,?,?,?,?)`).bind(id,orgId,title,clean(b.summary,600),content,clean(b.image_key,500),published,isoNow(),actorId).run();
  return { target_type:'news', target_id:id };
}
async function updateNews(env, orgId, b) {
  const id=clean(b.id,80), title=clean(b.title,180), content=clean(b.content,12000); if(!id||!title||!content) throw bad('Données incomplètes.');
  const r=await env.FONDATIONCK_DB.prepare(`UPDATE news SET title=?,summary=?,content=?,image_key=?,published=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?`).bind(title,clean(b.summary,600),content,clean(b.image_key,500),b.published===false?0:1,id,orgId).run(); ensureChanged(r);
  return { target_type:'news', target_id:id };
}
async function deleteNews(env, orgId, rawId) {
  const id=clean(rawId,80); const item=await env.FONDATIONCK_DB.prepare('SELECT image_key FROM news WHERE id=? AND organization_id=?').bind(id,orgId).first();
  const r=await env.FONDATIONCK_DB.prepare('DELETE FROM news WHERE id=? AND organization_id=?').bind(id,orgId).run(); ensureChanged(r);
  if(item?.image_key) await env.FONDATIONCK_KV.delete(`media:${item.image_key}`);
  return { target_type:'news', target_id:id };
}
async function updateSiteContent(env, orgId, b) {
  await env.FONDATIONCK_DB.prepare(`
    INSERT INTO site_content (organization_id,presentation,mission,vision,perspectives,contact_phone,whatsapp,contact_email,address,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(organization_id) DO UPDATE SET presentation=excluded.presentation,mission=excluded.mission,vision=excluded.vision,perspectives=excluded.perspectives,contact_phone=excluded.contact_phone,whatsapp=excluded.whatsapp,contact_email=excluded.contact_email,address=excluded.address,updated_at=CURRENT_TIMESTAMP
  `).bind(orgId,clean(b.presentation,5000),clean(b.mission,3000),clean(b.vision,3000),clean(b.perspectives,3000),clean(b.contact_phone,80),clean(b.whatsapp,80),clean(b.contact_email,180),clean(b.address,500)).run();
  return { target_type:'site_content', target_id:orgId };
}
async function createMember(env, orgId, b, actor) {
  const email=normalizeEmail(b.email), full=clean(b.full_name,140), password=String(b.password||'');
  if(!validEmail(email)||!full||password.length<8) throw bad('Nom, e-mail valide et mot de passe de 8 caractères minimum requis.');
  if(await env.FONDATIONCK_DB.prepare('SELECT id FROM users WHERE email=? COLLATE NOCASE').bind(email).first()) throw conflict('E-mail déjà utilisé.');
  const id=crypto.randomUUID(), start=isoNow(), expiry=addDays(start,10);
  await env.FONDATIONCK_DB.batch([
    env.FONDATIONCK_DB.prepare(`INSERT INTO users (id,organization_id,email,full_name,phone,role,status,plan,plan_started_at,plan_expires_at,must_change_password,access_json) VALUES (?,?,?,?,?,'member','active','free',?,?,1,?)`).bind(id,orgId,email,full,clean(b.phone,40),start,expiry,JSON.stringify(visitorAccess())),
    env.FONDATIONCK_DB.prepare('INSERT INTO credentials (user_id,password_hash) VALUES (?,?)').bind(id,await hashPassword(password))
  ]);
  return { target_type:'user', target_id:id, audit:{user_type:'visitor',created_by:actor?.id||''}, message:'Utilisateur créé avec le statut Visiteur.' };
}

async function setUserTypeByPrincipal(env, orgId, b, actor) {
  if (!isPrincipalAdmin(actor)) throw bad('Seul l’Administrateur principal peut modifier le statut d’un utilisateur.');
  const id=clean(b.id,80), type=['visitor','agent','subadmin'].includes(b.user_type)?b.user_type:'';
  if(!id||!type) throw bad('Statut utilisateur invalide.');
  if(id===actor.id) throw bad('L’Administrateur principal ne peut pas modifier son propre titre.');
  const target=await env.FONDATIONCK_DB.prepare(`SELECT id,role,access_json FROM users WHERE id=? AND organization_id=?`).bind(id,orgId).first();
  if(!target||target.role==='superadmin') throw bad('Compte non modifiable.');
  const targetType=accountType(target);
  if(targetType==='principal_admin') throw bad('Le titre Administrateur principal est géré uniquement par le Super Admin.');
  let role='member', access;
  if(type==='visitor') access=visitorAccess();
  else if(type==='agent') access=agentAccess(b.access||{});
  else { role='admin'; access=fullAdminAccess('subadmin'); }
  await env.FONDATIONCK_DB.prepare(`UPDATE users SET role=?,access_json=?,session_version=session_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?`)
    .bind(role,JSON.stringify(access),id,orgId).run();
  return {target_type:'user',target_id:id,audit:{from:targetType,to:type},message:`Statut ${type==='subadmin'?'Sous-administrateur':type==='agent'?'Agent':'Visiteur'} appliqué.`};
}

async function updateMemberAccess(env, orgId, b) {
  const id=clean(b.id,80); const target=await env.FONDATIONCK_DB.prepare(`SELECT role FROM users WHERE id=? AND organization_id=?`).bind(id,orgId).first();
  if(!target||target.role!=='member') throw bad('Seuls les accès des Agents peuvent être modifiés ici.');
  const current=await env.FONDATIONCK_DB.prepare(`SELECT access_json FROM users WHERE id=? AND organization_id=?`).bind(id,orgId).first();
  if(accountType(current)!=='agent') throw bad('Les autorisations détaillées concernent uniquement les Agents.');
  const r=await env.FONDATIONCK_DB.prepare('UPDATE users SET access_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?').bind(JSON.stringify(agentAccess(b.access)),id,orgId).run(); ensureChanged(r);
  return { target_type:'user', target_id:id };
}
async function resetMemberPassword(env, orgId, b) {
  const id=clean(b.id,80), password=String(b.password||''); if(password.length<8) throw bad('Mot de passe temporaire de 8 caractères minimum requis.');
  const target=await env.FONDATIONCK_DB.prepare(`SELECT id,role FROM users WHERE id=? AND organization_id=?`).bind(id,orgId).first();
  if(!target||target.role!=='member') throw bad('Seul le mot de passe d’un Visiteur ou d’un Agent peut être réinitialisé par un Administrateur.');
  await setPassword(env,id,password,true);
  return { target_type:'user', target_id:id, message:'Mot de passe de l’utilisateur réinitialisé. Toutes les anciennes sessions ont été invalidées.' };
}

async function resolveMemberReset(env, orgId, b, actorId) {
  const requestId=clean(b.request_id,80), password=String(b.password||''); if(password.length<8) throw bad('Mot de passe temporaire de 8 caractères minimum requis.');
  const req=await env.FONDATIONCK_DB.prepare(`SELECT * FROM password_reset_requests WHERE id=? AND organization_id=? AND status='pending' AND target_role='member'`).bind(requestId,orgId).first(); if(!req) throw bad('Demande introuvable.');
  await setPassword(env,req.user_id,password,true);
  await env.FONDATIONCK_DB.prepare(`UPDATE password_reset_requests SET status='resolved',resolved_at=CURRENT_TIMESTAMP,resolved_by=? WHERE id=?`).bind(actorId,requestId).run();
  return { target_type:'password_reset_request', target_id:requestId };
}
async function changeOwnPassword(env, user, b) {
  const current=String(b.current_password||''), next=String(b.new_password||''); if(next.length<8) throw bad('Le nouveau mot de passe doit avoir au moins 8 caractères.');
  const cred=await env.FONDATIONCK_DB.prepare('SELECT password_hash FROM credentials WHERE user_id=?').bind(user.id).first();
  if(!cred || !await verifyPassword(current,cred.password_hash)) throw bad('Mot de passe actuel incorrect.');
  await setPassword(env,user.id,next,false);
  return { target_type:'user', target_id:user.id, message:'Mot de passe modifié. Reconnectez-vous avec le nouveau mot de passe.' };
}

async function superSetStatus(env,selfId,b){
  const id=clean(b.id,80), status=b.status==='active'?'active':'disabled'; if(!id||id===selfId) throw bad('Opération interdite sur votre propre compte.');
  const target=await env.FONDATIONCK_DB.prepare('SELECT organization_id,role FROM users WHERE id=?').bind(id).first(); if(!target) throw bad('Compte introuvable.');
  const r=await env.FONDATIONCK_DB.prepare('UPDATE users SET status=?,session_version=session_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status,id).run(); ensureChanged(r);
  return { organization_id:target.organization_id,target_type:'user',target_id:id,audit:{status} };
}
async function superDeleteUser(env,selfId,b){
  const id=clean(b.id,80); if(!id||id===selfId) throw bad('Suppression de votre propre compte interdite.');
  const target=await env.FONDATIONCK_DB.prepare('SELECT organization_id,role FROM users WHERE id=?').bind(id).first(); if(!target) throw bad('Compte introuvable.');
  if(target.role==='superadmin') throw bad('Suppression d’un autre Super Admin non autorisée depuis cette interface.');
  await env.FONDATIONCK_DB.prepare('DELETE FROM users WHERE id=?').bind(id).run();
  return { organization_id:target.organization_id,target_type:'user',target_id:id };
}
async function superSetPlan(env,b){
  const id=clean(b.id,80), plan=['free','standard','business'].includes(b.plan)?b.plan:null; if(!id||!plan) throw bad('Plan invalide.');
  const target=await env.FONDATIONCK_DB.prepare('SELECT organization_id,role FROM users WHERE id=?').bind(id).first(); if(!target||target.role==='superadmin') throw bad('Compte non éligible.');
  const start=isoNow(),expiry=addDays(start,plan==='free'?10:plan==='standard'?30:365);
  await env.FONDATIONCK_DB.prepare('UPDATE users SET plan=?,plan_started_at=?,plan_expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(plan,start,expiry,id).run();
  return { organization_id:target.organization_id,target_type:'user',target_id:id,audit:{plan,expiry},message:`Plan ${plan} activé.` };
}
async function superResetPassword(env,b){
  const id=clean(b.id,80), password=String(b.password||''); if(password.length<8) throw bad('Mot de passe temporaire de 8 caractères minimum requis.');
  const target=await env.FONDATIONCK_DB.prepare('SELECT organization_id,role FROM users WHERE id=?').bind(id).first(); if(!target||target.role==='superadmin') throw bad('Réinitialisation de ce compte non autorisée.');
  await setPassword(env,id,password,true);
  return { organization_id:target.organization_id,target_type:'user',target_id:id,message:'Mot de passe réinitialisé et anciennes sessions invalidées.' };
}
async function superResolveReset(env,b,actorId){
  const requestId=clean(b.request_id,80),password=String(b.password||''); if(password.length<8) throw bad('Mot de passe temporaire de 8 caractères minimum requis.');
  const req=await env.FONDATIONCK_DB.prepare(`SELECT * FROM password_reset_requests WHERE id=? AND status='pending'`).bind(requestId).first(); if(!req) throw bad('Demande introuvable.');
  await setPassword(env,req.user_id,password,true);
  await env.FONDATIONCK_DB.prepare(`UPDATE password_reset_requests SET status='resolved',resolved_at=CURRENT_TIMESTAMP,resolved_by=? WHERE id=?`).bind(actorId,requestId).run();
  return { organization_id:req.organization_id,target_type:'password_reset_request',target_id:requestId };
}
async function superSetAccountType(env,b){
  const id=clean(b.id,80), type=['visitor','agent','subadmin','principal_admin'].includes(b.user_type)?b.user_type:'';
  if(!id||!type) throw bad('Type de compte invalide.');
  const target=await env.FONDATIONCK_DB.prepare('SELECT id,organization_id,role,access_json FROM users WHERE id=?').bind(id).first();
  if(!target||target.role==='superadmin') throw bad('Compte non modifiable.');
  if(type==='principal_admin'){
    const admins=await env.FONDATIONCK_DB.prepare(`SELECT id,access_json FROM users WHERE role='admin' AND id<>?`).bind(id).all();
    const existing=(admins.results||[]).find(u=>accountType(u)==='principal_admin');
    if(existing) throw conflict('Un Administrateur principal est déjà actif. Il ne peut y en avoir qu’un seul.');
  }
  let role='member', access;
  if(type==='visitor') access=visitorAccess();
  else if(type==='agent') access=agentAccess(b.access||{});
  else if(type==='subadmin'){role='admin';access=fullAdminAccess('subadmin');}
  else {role='admin';access=fullAdminAccess('principal_admin');}
  await env.FONDATIONCK_DB.prepare(`UPDATE users SET role=?,access_json=?,session_version=session_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(role,JSON.stringify(access),id).run();
  return {organization_id:target.organization_id,target_type:'user',target_id:id,audit:{account_type:type},message:`Titre ${type==='principal_admin'?'Administrateur principal':type==='subadmin'?'Sous-administrateur':type==='agent'?'Agent':'Visiteur'} appliqué.`};
}

async function superUpdateAccess(env,b){
  const id=clean(b.id,80),target=await env.FONDATIONCK_DB.prepare('SELECT organization_id,role,access_json FROM users WHERE id=?').bind(id).first(); if(!target||target.role==='superadmin'||accountType(target)!=='agent') throw bad('Les autorisations détaillées concernent uniquement les Agents.');
  await env.FONDATIONCK_DB.prepare('UPDATE users SET access_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(JSON.stringify(agentAccess(b.access)),id).run();
  return { organization_id:target.organization_id,target_type:'user',target_id:id };
}

async function verifyAdminApproval(env, agentUser, password, request) {
  const pwd=String(password||'');
  if(!pwd) return {ok:false,status:400,error:'Mot de passe Administrateur requis pour modifier ou supprimer.'};
  const key=`agent-approval:${agentUser.id}:${await sha256Hex(getIp(request))}`;
  if(await isLoginBlocked(env,key)) return {ok:false,status:429,error:'Trop de tentatives d’autorisation. Réessayez dans 15 minutes.'};
  const admins=await env.FONDATIONCK_DB.prepare(`
    SELECT u.id,c.password_hash FROM users u JOIN credentials c ON c.user_id=u.id
    WHERE u.organization_id=? AND u.role='admin' AND u.status='active'
    ORDER BY u.created_at ASC LIMIT 20
  `).bind(agentUser.organization_id).all();
  for(const admin of (admins.results||[])) {
    if(admin.password_hash && await verifyPassword(pwd,admin.password_hash)) {
      await env.FONDATIONCK_KV.delete(key);
      return {ok:true,admin_id:admin.id};
    }
  }
  await bumpLogin(env,key);
  return {ok:false,status:403,error:'Mot de passe Administrateur incorrect.'};
}

async function sectorContext(env,orgId,raw){
  const id=clean(raw,80); if(!id) return null;
  const row=await env.FONDATIONCK_DB.prepare('SELECT id,name,locality,village FROM sectors WHERE id=? AND organization_id=?').bind(id,orgId).first();
  if(!row) throw bad('Secteur, localité ou village invalide.');
  return row;
}
async function validSector(env,orgId,raw){
  const row=await sectorContext(env,orgId,raw);
  return row?.id || null;
}
async function setPassword(env,userId,password,mustChange){
  const hash=await hashPassword(password);
  await env.FONDATIONCK_DB.batch([
    env.FONDATIONCK_DB.prepare(`INSERT INTO credentials (user_id,password_hash,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash,updated_at=CURRENT_TIMESTAMP`).bind(userId,hash),
    env.FONDATIONCK_DB.prepare(`UPDATE users SET must_change_password=?,session_version=session_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(mustChange?1:0,userId)
  ]);
}
async function audit(env,orgId,actorId,role,action,targetType,targetId,ip,details){
  try { await env.FONDATIONCK_DB.prepare(`INSERT INTO audit_log (organization_id,actor_user_id,actor_role,action,target_type,target_id,ip_address,details_json) VALUES (?,?,?,?,?,?,?,?)`).bind(orgId,actorId,role,action,targetType,targetId,clean(ip,100),JSON.stringify(details||{}).slice(0,4000)).run(); } catch(e){ console.warn('Audit error',e?.message||e); }
}
function sanitizeUser(u){
  if(!u) return null;
  return { id:u.id,organization_id:u.organization_id,email:u.email,full_name:u.full_name,phone:u.phone||'',role:u.role,status:u.status,plan:u.plan,plan_started_at:u.plan_started_at,plan_expires_at:u.plan_expires_at,must_change_password:!!u.must_change_password,access:parseAccess(u.access_json,u.role),created_at:u.created_at };
}
function planInfo(u){ return { name:u.plan,started_at:u.plan_started_at,expires_at:u.plan_expires_at,active:isSubscriptionActive(u),days_remaining:daysRemaining(u.plan_expires_at) }; }
function isSubscriptionActive(u){ if(u.role==='superadmin') return true; return new Date(u.plan_expires_at).getTime() > Date.now(); }
function daysRemaining(exp){ return Math.max(0,Math.ceil((new Date(exp).getTime()-Date.now())/86400000)); }
function parseAccess(raw,role){
  let a={}; try{a=JSON.parse(raw||'{}')||{};}catch{}
  if(role==='superadmin') return {...fullAdminAccess('superadmin')};
  if(role==='admin') {
    const type=a.account_type==='principal_admin'?'principal_admin':'subadmin';
    return fullAdminAccess(type);
  }
  if(a.account_type==='visitor') return visitorAccess();
  return agentAccess(a);
}
function accountType(u){
  if(!u) return '';
  if(u.role==='superadmin') return 'superadmin';
  let a={}; try{a=typeof u.access_json==='string'?JSON.parse(u.access_json||'{}'):(u.access||u||{});}catch{}
  if(u.role==='admin') return a.account_type==='principal_admin'?'principal_admin':'subadmin';
  return a.account_type==='visitor'?'visitor':'agent';
}
function isPrincipalAdmin(u){ return u?.role==='admin' && accountType(u)==='principal_admin'; }
function fullAdminAccess(type='subadmin'){ return {home:true,sectors:true,responsibles:true,girls:true,boys:true,reports:true,settings:true,can_add:true,can_print:true,account_type:type}; }
function visitorAccess(){ return {home:true,sectors:true,responsibles:true,girls:true,boys:true,reports:true,settings:true,can_add:false,can_print:false,account_type:'visitor'}; }
function agentAccess(a={}){ return {home:true,sectors:a?.sectors!==false,responsibles:a?.responsibles!==false,girls:a?.girls!==false,boys:a?.boys!==false,reports:a?.reports!==false,settings:true,can_add:a?.can_add!==false,can_print:a?.can_print!==false,account_type:'agent'}; }
function normalizeAccess(a){ return agentAccess(a); }

async function hashPassword(password){
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:PBKDF2_ITERATIONS},key,256);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toB64(salt)}$${toB64(new Uint8Array(bits))}`;
}
async function verifyPassword(password,serialized){
  const parts=String(serialized||'').split('$'); if(parts.length!==4||parts[0]!=='pbkdf2') return false;
  const iterations=Number(parts[1]); if(!Number.isFinite(iterations)||iterations<100000||iterations>PBKDF2_MAX_ITERATIONS) return false;
  const salt=fromB64(parts[2]), expected=fromB64(parts[3]);
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,expected.length*8);
  const actual=new Uint8Array(bits); if(actual.length!==expected.length) return false;
  let diff=0; for(let i=0;i<actual.length;i++) diff|=actual[i]^expected[i]; return diff===0;
}
function toB64(bytes){ let s=''; for(const b of bytes)s+=String.fromCharCode(b); return btoa(s); }
function fromB64(s){ const bin=atob(s), out=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i); return out; }
function randomToken(bytes){ return toB64(crypto.getRandomValues(new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
async function sha256Hex(text){ const b=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(String(text||'')))); return [...b].map(x=>x.toString(16).padStart(2,'0')).join(''); }

async function isLoginBlocked(env,key){ const raw=await env.FONDATIONCK_KV.get(key); if(!raw)return false; try{return JSON.parse(raw).count>=LOGIN_MAX_ATTEMPTS;}catch{return false;} }
async function bumpLogin(env,key){ const raw=await env.FONDATIONCK_KV.get(key); let count=0; try{count=raw?JSON.parse(raw).count:0;}catch{} await env.FONDATIONCK_KV.put(key,JSON.stringify({count:count+1}),{expirationTtl:RATE_WINDOW}); }
async function limited(env,key,max,ttl){ const raw=await env.FONDATIONCK_KV.get(`rl:${key}`); let count=0; try{count=raw?Number(raw):0;}catch{} if(count>=max)return true; await env.FONDATIONCK_KV.put(`rl:${key}`,String(count+1),{expirationTtl:ttl}); return false; }

function validCsrf(request,session){ const token=request.headers.get('X-CSRF-Token'); return !!token && token===session.csrf; }
function cookieValue(request,name){ const cookie=request.headers.get('Cookie')||''; for(const part of cookie.split(';')){ const [k,...v]=part.trim().split('='); if(k===name)return decodeURIComponent(v.join('=')); } return ''; }
function sessionCookie(token){ return `fck_session=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_TTL}; HttpOnly; Secure; SameSite=Lax`; }
function expiredCookie(){ return 'fck_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'; }
function getIp(request){ return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown'; }
function clean(v,max=500){ return String(v??'').trim().slice(0,max); }
function normalizeEmail(v){ return clean(v,180).toLowerCase(); }
function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function isoNow(){ return new Date().toISOString(); }
function addDays(iso,days){ const d=new Date(iso); d.setUTCDate(d.getUTCDate()+days); return d.toISOString(); }
async function safeJson(request){ try{return await request.json();}catch{return {};} }
function ensureChanged(r){ if(!r?.meta?.changes) throw bad('Élément introuvable ou non autorisé.'); }
function bad(message){ const e=new Error(message); e.status=400; return e; }
function conflict(message){ const e=new Error(message); e.status=409; return e; }
function json(data,status=200,extra={}){ return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}}); }
