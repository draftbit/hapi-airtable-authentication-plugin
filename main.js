"use strict";

const Joi = require("joi");

const routes = require("./routes");

const schema = Joi.object().keys({
  airtableBase: Joi.string().required(),
  airtableApiToken: Joi.string().required(),
  jwtSecret: Joi.string().required(),
  apiUrl: Joi.string()
    .uri()
    .required(),
  verifyCallback: Joi.func().arity(1)
});

module.exports = {
  pkg: require("./package.json"),
  multiple: true,
  register: async function(server, options) {
    const validSchema = schema.validate(options);

    if (validSchema.error) {
      throw new Error(
        "Invalid schema passed to Airtable Authentication plugin"
      );
    }

    server.route(routes(options));
  }
};
