import jwt from 'jsonwebtoken';
import { adminEmail } from '../config/admin.js';

export const ADMIN_TOKEN_PURPOSE = 'platform-admin';

export function adminRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const email = adminEmail();
    if (
      payload.purpose !== ADMIN_TOKEN_PURPOSE ||
      !email ||
      String(payload.email || '').toLowerCase() !== email
    ) {
      return res.status(403).json({ message: 'Admin access only' });
    }
    req.adminEmail = email;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired admin session' });
  }
}
