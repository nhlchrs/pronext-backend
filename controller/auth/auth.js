
import express  from "express"
import {register,login, getAllUsersExceptLoggedIn, getUserbyId, verifyOtp, resendOtp } from "./authContoller.js"
import {requireSignin,validateUser} from "../../middleware/authMiddleware.js"

const router = express.Router()

router.post("/register" ,validateUser, register)
router.post("/verify" , verifyOtp)
router.post("/resendOtp" , resendOtp)
router.post("/login" , login)
router.get('/allusers', requireSignin, getAllUsersExceptLoggedIn);
router.post('/getUserbyId', requireSignin, getUserbyId);



export default router
