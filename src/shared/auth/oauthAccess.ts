export function parseOAuthAllowedDomains(value = "") {
  return value
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

export function getEmailDomain(email: string) {
  return email.split("@")[1]?.toLowerCase() || "";
}

export function isOAuthDomainAllowed(email: string, allowedDomainsValue = "") {
  const domain = getEmailDomain(email);
  if (!domain) return false;
  return parseOAuthAllowedDomains(allowedDomainsValue).includes(domain);
}
