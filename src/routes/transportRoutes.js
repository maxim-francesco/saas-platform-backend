// src/routes/transportRoutes.js
const express = require("express");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const { requireNetworkMember } = require("../middlewares/networkMiddleware");
const validate = require("../middlewares/validate");
const {
  createTransportRunSchema,
  expressInterestSchema,
  updateTransportRunSchema,
} = require("../validations/schemas");
const {
  createRun,
  browseRuns,
  myRuns,
  getRunInterests,
  expressInterest,
  updateRun,
  deleteRun,
  interestsCount,
} = require("../controllers/transportController");

const router = express.Router();

router.use(isAuthenticated);
router.use(requireNetworkMember);

router.post("/", validate(createTransportRunSchema), createRun);
router.get("/", browseRuns);
router.get("/mine", myRuns);
router.get("/interests/count", interestsCount);
router.get("/:runId/interests", getRunInterests);
router.post("/:runId/interest", validate(expressInterestSchema), expressInterest);
router.patch("/:id", validate(updateTransportRunSchema), updateRun);
router.delete("/:id", deleteRun);

module.exports = router;
