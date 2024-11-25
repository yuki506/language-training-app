// SessionMiddleware.js

function ensureAuthenticated(req, res, next) {
    // ログインページと静的ファイルにはセッションチェックをスキップ
    if (req.path === '/login' || req.path.startsWith('/app') || req.path.startsWith('/public')) {
        return next();
    }
    if (req.session && req.session.userId) {
        return next();
    } else {
        res.redirect('/login');
    }
}

// CommonJS
module.exports = ensureAuthenticated;