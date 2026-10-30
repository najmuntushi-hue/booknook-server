let jwks;

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).send({ message: "Unauthorized: token missing" });
    }
    const token = authHeader.split(" ")[1];

    const { jwtVerify, createRemoteJWKSet } = await import("jose");
    if (!jwks) jwks = createRemoteJWKSet(new URL(process.env.JWKS_URL));

    const { payload } = await jwtVerify(token, jwks);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).send({ message: "Unauthorized: invalid token" });
  }
};

module.exports = verifyToken;