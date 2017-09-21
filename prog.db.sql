BEGIN TRANSACTION;
CREATE TABLE `users` (
	`userID`	TEXT UNIQUE,
	`username`	TEXT,
	`discriminator`	INTEGER,
	`status`	TEXT,
	`friend`	INTEGER
);
CREATE TABLE `directmessages` (
	`channelID`	TEXT UNIQUE,
	`userID`	TEXT
);
COMMIT;
