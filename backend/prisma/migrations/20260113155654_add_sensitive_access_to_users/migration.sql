-- AlterTable
ALTER TABLE `users`
ADD COLUMN `has_sensitive_access` BOOLEAN NOT NULL DEFAULT false;

-- Set default sensitive access based on role
UPDATE `users` u
INNER JOIN `roles` r ON u.role_id = r.id
SET
    u.has_sensitive_access = true
WHERE
    r.name IN (
        'Superadmin',
        'Admin',
        'Manager'
    );