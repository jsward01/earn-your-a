-- Student profile picture. Either 'preset:<name>' (a bundled avatar in
-- public/avatars/<name>.webp) or an uploaded, client-resized image as a
-- data:image/{jpeg,png,webp};base64,... URL. NULL = show initials.
ALTER TABLE users ADD COLUMN avatar TEXT;
