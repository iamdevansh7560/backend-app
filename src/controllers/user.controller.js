import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAcessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    const safeUser = user.toObject();

    // delete sensitive fields
    delete safeUser.password;
    delete safeUser.refreshToken;

    return { accessToken, refreshToken, safeUser };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //get user details from frontend
  //validation- not empty//
  //check if user already exist : username , email
  //check fro images,check for avtar --------> upload to cloudinary
  //create user object ------> create entry in DB |
  // reomve password and refresh token field from reponse
  // check for user creation
  // return res

  const { fullName, email, username, password } = req.body;

  const requiredFields = { fullName, email, username, password };

  for (const [key, value] of Object.entries(requiredFields)) {
    if (!value || value.trim() === "") {
      throw new ApiError(400, `${key} is required`);
    }
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avtar file is required");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avtar file is required cloudinary");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username,
  });
  console.log(user);
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while regestering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User created successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // req body ----> data
  //username or email
  //find user
  //check password
  //generate accessToken & refreshToken
  //send cookie

  const { email, username, password } = req.body;
  if (!username && !email) {
    throw new ApiError(400, "Username or Email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User doesn't exist");
  }

  const isPassowrdValid = await user.isPasswordCorrect(password);

  if (!isPassowrdValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const {
    accessToken,
    refreshToken,
    safeUser: loggedInUser,
  } = await generateAccessAndRefreshToken(user.id);

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out"));
});

const refreshAcessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request");
  }
  const decodedToken = jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );
  const user = await User.findById(decodedToken?._id);

  if (!user) {
    throw new ApiError(401, "Inavlid refresh token");
  }

  if (incomingRefreshToken != user?.refreshToken) {
    throw new ApiError(401, "Refresh token is expired or used");
  }

  const options = {
    httpOnly: true,
    secure: true,
  };

  const { accessToken, newrefreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("RefreshToken", newrefreshToken, options)
    .json(
      new ApiResponse(
        200,
        { accessToken, refreshToken: newrefreshToken },
        "Access Token refreshed"
      )
    );
});
export { registerUser, loginUser, logoutUser, refreshAcessToken };
