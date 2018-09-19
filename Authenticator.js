const Airtable = require("airtable");
const Jwt = require("jsonwebtoken");

const makeQueryString = require("./makeQueryString");

module.exports = class Authenticator {
  constructor(options) {
    const base = new Airtable({ apiKey: options.airtableApiToken }).base(
      options.airtableBase
    );

    this.base = base;
    this.apiUrl = options.apiUrl;
    this.verifyCallback = options.verifyCallback;
    this.jwtSecret = options.jwtSecret;
  }

  async sendAuthenticationEmail(email, linkingUri) {
    const user = await this.getAirtableUserByEmail(email);

    let userId;
    if (!user) {
      userId = await new Promise(resolve =>
        this.base("Users").create(
          {
            email
          },
          (err, record) => {
            resolve(record.id);
          }
        )
      );
    } else {
      userId = user.id;
    }

    const {
      token,
      loginCode
    } = await this.createAuthenticationTokenAndLoginCode(userId, email);

    const qs = makeQueryString({
      token,
      linkingUri: encodeURIComponent(linkingUri)
    });

    const verificationUrl = `${this.apiUrl}/confirm?${qs}`;
    this.verifyCallback({ verificationUrl, email, loginCode });

    return { OK: true };
  }

  async createAuthenticationTokenAndLoginCode(
    userId,
    email,
    expiresIn = "30m"
  ) {
    const loginCode = Math.floor(Math.random() * 90000) + 10000;

    await this.updateAirtableUser({
      id: userId,
      fields: { login_code: loginCode.toString() }
    });

    const token = Jwt.sign(
      {
        aud: userId,
        iss: this.apiUrl,
        data: { loginCode, email }
      },
      this.jwtSecret,
      { expiresIn }
    );

    return { token, loginCode };
  }

  async refreshToken(userId, token) {
    const decoded = Jwt.verify(token, this.jwtSecret);
    const email = decoded.data.email;
    const newToken = Jwt.sign(
      {
        aud: userId,
        iss: this.apiUrl,
        data: { email }
      },
      this.jwtSecret,
      {
        expiresIn: "1y"
      }
    );
    return newToken;
  }

  async verifyAuthenticationToken(token) {
    let decoded;
    try {
      decoded = Jwt.verify(token, this.jwtSecret, {
        issuer: this.apiUrl
      });
    } catch (err) {
      return false;
    }

    const userId = decoded.aud;

    const user = await this.getAirtableUserById(userId);
    const loginCode = user.login_code;

    const tokenValid =
      decoded && decoded.data && decoded.data.loginCode === Number(loginCode);

    await this.updateAirtableUser({
      id: userId,
      fields: { email_confirmed: true }
    });

    return { tokenValid, userId };
  }

  async verifyLoginCode(email, code) {
    const user = await this.getAirtableUserByEmail(email);

    if (user && user.login_code === code) {
      return { userId: user.id };
    }
  }

  validateDecodedJwt(decoded) {
    if (!decoded || !decoded.data) return { isValid: false };

    const userId = decoded.aud;
    const email = decoded.data.email;

    if (!userId || !email || decoded.iss !== this.apiUrl)
      return { isValid: false };

    return { isValid: true };
  }

  extractUserIdFromHeader(header) {
    if (!header) return null;

    const token = header.replace("Bearer ", "");
    const decoded = Jwt.verify(token, this.jwtSecret);
    return decoded.aud;
  }

  async getAirtableUserByEmail(email) {
    return new Promise(resolve =>
      this.base("Users")
        .select({
          view: "Grid view",
          filterByFormula: `{email}='${email}'`
        })
        .firstPage((err, records) => {
          if (!records.length) return resolve();

          resolve({
            id: records[0].id,
            login_code: records[0].get("login_code")
          });
        })
    );
  }

  async getAirtableUserById(id) {
    return new Promise(resolve =>
      this.base("Users").find(id, (err, record) => {
        resolve(record.fields);
      })
    );
  }

  async updateAirtableUser({ id, fields }) {
    return new Promise(resolve =>
      this.base("Users").update(id, fields, (err, record) =>
        resolve({
          id: record.id
        })
      )
    );
  }
};
