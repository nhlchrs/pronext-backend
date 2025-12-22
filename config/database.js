import mongoose from "mongoose"
const connectDB = async ()=>{
    try{
       const con = await mongoose.connect(process.env.MONGODB_URI)
        console.log(`connect to database ${con.connection.host}`)
    }
    catch(error){
        console.log("Error connection...",error)
    }
}
export default connectDB