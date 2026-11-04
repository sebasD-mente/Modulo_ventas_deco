import {
  authEnv as ENV,
  googleClient,
  getPublicGoogleClientId,
  authenticateGooglePayload,
  resolveAuthenticatedUser,
} from '../services/authService.js';

export function getAuthConfig(req, res) {
  return res.status(200).json({
    success: true,
    googleClientId: getPublicGoogleClientId(),
  });
}

export async function handleGoogleLogin(req, res) {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere autenticación obligatoria con Google. No se proporcionó un token de identidad válido.',
      });
    }

    if (!ENV.GOOGLE_CLIENT_ID) {
      console.error('[Auth Error] 🛑 GOOGLE_CLIENT_ID no configurado en entorno.');
      return res.status(500).json({
        success: false,
        error: 'Configuración de autenticación incompleta en el servidor: GOOGLE_CLIENT_ID no configurado.',
      });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: ENV.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      console.error('[Auth Error] ❌ Fallo de verificación criptográfica Google:', verifyErr.message);
      return res.status(401).json({
        success: false,
        error: 'Token de Google inválido o verificación criptográfica de firma fallida.',
      });
    }

    if (!payload || !payload.email) {
      return res.status(401).json({
        success: false,
        error: 'La verificación criptográfica con Google ha fallado: payload incompleto.',
      });
    }

    const session = await authenticateGooglePayload(payload);

    return res.status(200).json({
      success: true,
      token: session.token,
      user: session.user,
    });
  } catch (error) {
    if (error?.statusCode === 403) {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    console.error('[Auth Error] Fallo al procesar autenticación:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al autenticar usuario.',
      details: error.message,
    });
  }
}

export async function getMe(req, res) {
  try {
    const user = await resolveAuthenticatedUser(req.user);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
    }
    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
