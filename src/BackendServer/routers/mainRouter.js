const express = require("express");
const router = express.Router();
const path = require("path");
const publicDirPath = require("../public/toGetDir");

router.get("/", (req, res) => {
  res.render("RootPage", { layout: false });
  // res.sendFile(`${publicDirPath}/RootPage.html`);
});

module.exports = router;
