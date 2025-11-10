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
    Phone:{
        type: String,
        required: true,
    },
    
    Address: {
        type: String,
    },
    
    ReferralCode : {
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

    role: {
        type: String,
        enum: ["Admin", "Finance", "Support", "Educator"],
        default: "Educator"
    },
   
}, { timestamps: true });

export default mongoose.model("Users", UserSchema);
