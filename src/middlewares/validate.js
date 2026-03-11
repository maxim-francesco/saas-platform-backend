// src/middlewares/validate.js
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,    // returnează TOATE erorile, nu doar prima
      stripUnknown: true,   // elimină câmpurile necunoscute din body
    });

    if (error) {
      const messages = error.details.map((d) => d.message);
      return res.status(400).json({ message: "Date invalide.", errors: messages });
    }

    next();
  };
};

module.exports = validate;