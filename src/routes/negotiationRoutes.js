const express = require("express");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const { requireNetworkMember } = require("../middlewares/networkMiddleware");
const validate = require("../middlewares/validate");
const {
  createProposalSchema,
  counterProposalSchema
} = require("../validations/schemas");
const {
  createProposal,
  listNegotiations,
  pendingCount,
  getNegotiation,
  accept,
  decline,
  counter,
  cancel
} = require("../controllers/negotiationController");

const router = express.Router();

router.use(isAuthenticated);
router.use(requireNetworkMember);

router.post("/", validate(createProposalSchema), createProposal);
router.get("/", listNegotiations);
router.get("/pending/count", pendingCount);
router.get("/:id", getNegotiation);
router.post("/:id/accept", accept);
router.post("/:id/decline", decline);
router.post("/:id/counter", validate(counterProposalSchema), counter);
router.post("/:id/cancel", cancel);

module.exports = router;
