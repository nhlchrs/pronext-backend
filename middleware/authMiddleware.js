import jwt from 'jsonwebtoken';

export const requireSignin = async (req, res, next) => {
  try {
    const token = req.headers.authorization;

    if (!token) {
      return res.status(401).send({
        success: false,
        message: "Jwt token missing"
    });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    next();
  } catch (err) {   
    return res.status(401).send({
      success: false,
      message: "Unauthorized Access."
  });
  }
};
export const validateUser = (req, res, next) => {
    const { fname,lname, email, password} = req.body;
  
    if (!fname || !lname || !email || !password) {
      return res.status(400).send({ error: "All fields are required" });
    }
  
    next();
  };
  
  

  import bcrypt from "bcrypt"

export const hashPassword = async (password)=>{
    try{
        const saltRound = 10
        const hashedPassword = await bcrypt.hash(password,saltRound)
        return hashedPassword
    }
    catch(err){
        console.log(err)
    }
}

export const compairPassword =  async(password,hashedPassword) =>{
    return bcrypt.compare(password,hashedPassword)
}