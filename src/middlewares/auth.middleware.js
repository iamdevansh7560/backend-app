import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");
    // console.log( req.cookies)
  if (!token) {
    throw new ApiError(401, "Unauthorizaed request");
  }
  const decodeToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

  const user = await User.findById(decodeToken?._id).select(
    "-password -refreshToken"
  );

  if (!user) {
    throw new ApiError(401, "Invalid Acess Token");
  }

  req.user=user;
  next()
});
