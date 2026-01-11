
import express  from "express"
import {register,login, getAllUsersExceptLoggedIn, getUserbyId, verifyOtp, resendOtp,getUserPlatformMetrics, getDashboardVisualizations, updateUserSuspensionStatus, forgotPassword, resetPassword } from "./authContoller.js"
import {requireSignin,validateUser, isAdmin} from "../../middleware/authMiddleware.js"

const router = express.Router()

router.post("/register" ,validateUser, register)
router.post("/verify" , verifyOtp)
router.post("/resendOtp" , resendOtp)
router.post("/login" , login)
router.post("/forgot-password", forgotPassword)
router.post("/reset-password", resetPassword)
router.get('/allusers', requireSignin, getAllUsersExceptLoggedIn);
router.post('/getUserbyId', requireSignin, getUserbyId);
router.get('/getUserPlatformMetrics', getUserPlatformMetrics);
router.get('/getDashboardVisualizations', getDashboardVisualizations);
router.put('/users/:userId/suspend-status', requireSignin, isAdmin, updateUserSuspensionStatus);



export default router
