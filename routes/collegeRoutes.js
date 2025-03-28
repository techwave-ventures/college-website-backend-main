const express = require("express")
const router = express.Router()

const { createcollege, getcollege } = require("../controller/collegeController")
const { createBranch } = require("../controller/branchController")
const { createPlacement } = require("../controller/placementController")

router.post("/",createcollege);
router.post("/:collegeId/branch", createBranch);
router.post("/:collegeId/placement", createPlacement)
router.get("/:collegeId/", getcollege)

module.exports = router
