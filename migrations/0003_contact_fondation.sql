-- Coordonnées officielles LA FONDATION CK
UPDATE site_content
SET contact_phone = CASE WHEN TRIM(COALESCE(contact_phone,'')) = '' THEN '0757577542 / 0545202646' ELSE contact_phone END,
    contact_email = CASE WHEN TRIM(COALESCE(contact_email,'')) = '' THEN 'oukami011@gmail.com' ELSE contact_email END,
    address = CASE WHEN TRIM(COALESCE(address,'')) = '' THEN 'Côte d’Ivoire' ELSE address END,
    updated_at = CURRENT_TIMESTAMP
WHERE organization_id = 'org_fondation_ck';
