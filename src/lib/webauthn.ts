export const rpName = "AreBook Admin";

export const rpID = process.env.WEBAUTHN_RP_ID || "localhost";

export const origin = process.env.WEBAUTHN_ORIGIN || `https://${rpID}`;