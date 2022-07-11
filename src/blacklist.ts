
const blacklistedIds = [
	'716042108267397280'
]

const isBlacklisted = (userId: string) => {
	return blacklistedIds.includes(userId);
}

export { isBlacklisted };