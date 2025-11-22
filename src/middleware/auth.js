const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

function authRequired(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Sem token de autenticação. Faça login para acessar este recurso.' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido ou expirado. Faça login novamente.' });
  }
}

function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito a administradores. Faça login como administrador para excluir produtos.' });
    next();
  });
}

module.exports = { authRequired, adminRequired };