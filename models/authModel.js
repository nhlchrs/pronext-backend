import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    fname: {
        type: String,
        required: true,
        trim: true
    },
    lname: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone:{
        type: String,
        required: true,
    },
    
    address: {
        type: String,
    },
    
    referralCode : {
        type: String,
        
    },
    password: {
        type: String,
        required: true,
    },
    otp: {
        type: String,
        default : "",
    },
  dailyLoginCount: {
    type: Number,
    default: 0,
  },
  lastLoginDate: {
    type: Date,
    default: null,
  },
  isSuspended: {
    type: Boolean,
    default: false,
  },

    role: {
        type: String,
        enum: ["Admin", "Finance", "Support", "Educator"],
        default: "Educator"
    },
   
}, { timestamps: true });

export default mongoose.model("Users", UserSchema);
