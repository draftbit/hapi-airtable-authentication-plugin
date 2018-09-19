module.exports = params =>
  Object.keys(params)
    .map(k => `${k}=${params[k]}`)
    .join("&");
