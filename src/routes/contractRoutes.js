const express = require("express");
const { createContract, listContracts, getContract, updateHandover } = require("../controllers/contractController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();
const validate = require("../middlewares/validate");
const { createContractSchema, handoverSchema } = require("../validations/schemas");

router.use(isAuthenticated);

router.post("/", validate(createContractSchema), createContract);
router.get("/", listContracts);
router.get("/:id", getContract);
router.patch("/:id/handover", validate(handoverSchema), updateHandover);

module.exports = router;
