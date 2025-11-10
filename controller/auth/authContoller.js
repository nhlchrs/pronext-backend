import { compairPassword, hashPassword } from "../../middleware/authMiddleware.js";
import userModel from "../../models/authModel.js";
import Jwt from "jsonwebtoken";
import {
  ErrorResponse,
  successResponse,
  notFoundResponse,
  successResponseWithData
} from "../../helpers/apiResponse.js";
    const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

export const register = async (req, res) => {
  try {
    const { fname, lname, email, password, Phone, Address, ReferralCode, role } = req.body;
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return ErrorResponse(res, "User already Exist");
    }

    const hashedPassword = await hashPassword(password);

     await new userModel({
      fname,
      lname,
      email,
      password: hashedPassword,
      Phone,
      Address,
      ReferralCode,
       role: role ,
       otp : generateOTP()
    }).save();
    return successResponse(res, `User created successfully ${otp}`);
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success: false,
      message: "Error while Registering",
      err,
    });
  }
};
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return ErrorResponse(res, "Email and OTP are required");
    }
    const user = await userModel.findOne({ email });
    if (!user) {
      return notFoundResponse(res, "User not found");
    }
      const currentTime = new Date();
    const updatedTime = new Date(user.updatedAt);
    const diffInMs = currentTime - updatedTime; 
    const diffInMinutes = diffInMs / (1000 * 60);

    if (diffInMinutes > 1) {
      return ErrorResponse(res, "OTP expired, please request a new one");
    }

    if (user.otp !== otp) {
      return ErrorResponse(res, "Invalid OTP");
    }

    user.otp = null;
    await user.save();

    const jwtPayload = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    const token = Jwt.sign(jwtPayload, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    return successResponseWithData(res, "OTP verified successfully", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res.status(500).send({
      success: false,
      message: "Error while verifying OTP",
      error: error.message,
    });
  }
};
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return ErrorResponse(res, "Email is required");
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    const newOtp = generateOTP();
    user.otp = newOtp;
    await user.save();


    return successResponseWithData(res, `OTP resent successfully ${otp}`, {
      email: user.email,
      otp: newOtp, 
    });
  } catch (error) {
    console.error("Error while resending OTP:", error);
    return res.status(500).send({
      success: false,
      message: "Error while resending OTP",
      error: error.message,
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return notFoundResponse(res, "Email or Password wrong");
    }
    const user = await userModel.findOne({ email });
    if (!user) {
      return notFoundResponse(res, "Email  not found");
     
    }

    const match = await compairPassword(password, user.password);

    if (!match) {
      return ErrorResponse(res, " Password wrong");
     
    }
        const otp = generateOTP();
    user.otp = otp;
    await user.save();

    const additionalData = {
      email: user.email,
      name: user.fname,
      password: user.password,
      createdAt: user.createdAt,
    };
    const jwtPayload = { _id: user._id, ...additionalData };

    const token = await Jwt.sign(jwtPayload, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
    return successResponseWithData(res, `Login successfully ${otp} `,{
      user: {
          id: user._id,
          name: user.fname,
          lname: user.lname,
          email: user.email,
          role : user.role,
          phone: user.phone,
      }, token
  });
    
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Error while login.....",
    });
  }
};

export const getAllUsersExceptLoggedIn = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const users = await userModel.find({ _id: { $ne: loggedInUserId } });

    return successResponseWithData(res, "Users fetched successfully", users);
  } catch (error) {
    console.error("Error occurred while fetching users:", error);
    res.status(500).send({
      success: false,
      message: "Error while fetching users",
    });
  }
};
export const getUserbyId = async (req, res) => {
  try {
    const {id} = req.body;
    const users = await userModel.find({ _id:  id });

    return successResponseWithData(res, "Users fetched successfully", users);
  } catch (error) {
    console.error("Error occurred while fetching users:", error);
    res.status(500).send({
      success: false,
      message: "Error while fetching users",
    });
  }
};