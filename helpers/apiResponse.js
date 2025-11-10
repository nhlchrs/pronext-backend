export const successResponse = function (res, msg) {
	var data = {
		status: 1,
		message: msg
	};
	return res.status(200).json(data);
};

export const successResponseWithData = function (res, msg, data, count) {
	var resData = {
		status: 1,
		message: msg,
		count: count,
		data: data
	};
	return res.status(200).json(resData);
};

export const ErrorResponse = function (res, msg) {
	var data = {
		status: 0,
		message: msg
	};
	return res.status(400).json(data);
};

export const ErrorResponseWithData = function (res, msg, data) {
	var resData = {
		status: 0,
		message: msg,
		data: data
	};
	return res.status(400).json(resData);
};

export const notFoundResponse = function (res, msg) {
	var data = {
		status: 0,
		message: msg,
	};
	return res.status(404).json(data);
};

export const validationErrorWithData = function (res, msg, data) {
	var resData = {
		status: 0,
		message: msg,
		data: data
	};
	return res.status(400).json(resData);
};

export const validationError = function (res, msg) {
	var resData = {
		status: 0,
		message: msg
	};
	return res.status(400).json(resData);
};

export const unauthorizedResponse = function (res, msg) {
	var data = {
		status: 0,
		message: msg,
	};
	return res.status(401).json(data);
};