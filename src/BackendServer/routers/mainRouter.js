const express = require("express");
const router = express.Router();
const path = require("path");
const publicDirPath = require("../public/toGetDir");
const { checkNotAuthenticated } = require('../middleware/auth');

router.get("/", (req, res) => {
  res.render("RootPage", { layout: false });
  // res.sendFile(`${publicDirPath}/RootPage.html`);
});

router.get("/AccessPortal", checkNotAuthenticated, (req, res) => {
  res.render("AccessPortal", { layout: false });
});

module.exports = router;
