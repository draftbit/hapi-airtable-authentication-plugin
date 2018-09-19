"use strict";

const Boom = require("boom");
const Joi = require("joi");

const Authenticator = require("./Authenticator");
const makeQueryString = require("./makeQueryString");

module.exports = function routes(options) {
  return [
    {
      method: "GET",
      path: "/verify",
      config: {
        auth: false,
        validate: {
          query: {
            email: Joi.string()
              .email()
              .required(),
            linkingUri: Joi.string().required()
          }
        }
      },
      handler: async request => {
        const authenticator = new Authenticator(options);

        return authenticator.sendAuthenticationEmail(
          request.query.email,
          request.query.linkingUri
        );
      }
    },
    {
      method: "GET",
      path: "/confirm",
      config: {
        auth: false,
        validate: {
          query: {
            token: Joi.string().required(),
            linkingUri: Joi.string().required()
          }
        }
      },
      handler: async (request, h) => {
        const authenticator = new Authenticator(options);

        const { token, linkingUri } = request.query;
        const {
          tokenValid,
          userId
        } = await authenticator.verifyAuthenticationToken(token);

        if (!tokenValid) {
          return h.redirect(`${linkingUri}?errorCode=401`);
        }

        const refreshedToken = await authenticator.refreshToken(userId, token);

        const qs = makeQueryString({ userId, token });

        return h.redirect(`${linkingUri}?${qs}`);
      }
    },
    {
      method: "GET",
      path: "/confirm-code",
      config: {
        auth: false,
        validate: {
          query: {
            email: Joi.string()
              .email()
              .required(),
            code: Joi.string()
              .required()
              .min(5)
              .max(5)
          }
        }
      },
      handler: async request => {
        const { email, code } = request.query;

        const authenticator = new Authenticator(options);

        const user = await authenticator.verifyLoginCode(email, code);

        if (user) {
          const { userId } = user;
          const {
            token
          } = await authenticator.createAuthenticationTokenAndLoginCode(
            userId,
            email,
            "1y"
          );

          return {
            userId,
            token
          };
        } else return Boom.unauthorized();
      }
    }
  ];
};
