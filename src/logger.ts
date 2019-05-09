import "colors";

function Timestamp(): string {
	return ('[' + new Date().toUTCString() + ']').green;
};

export function Log(User: string, Message: string, Details: string) {
	console.log(Timestamp(), User.white.bold, Message.white, Details.white.bold);
};

export function Info(User: string, Message: string, Details: string) {
	console.info(Timestamp(), User.gray.bold, Message.gray, Details.gray.bold);
};

export function Warn(User: string, Message: string, Details: string) {
	console.warn(Timestamp(), User.yellow.bold, Message.yellow, Details.yellow.bold);
};

export function Error(Err: Error) {
	console.error(Timestamp(), Err.message.red.bold);
};

export default { Log, Info, Warn, Error };
