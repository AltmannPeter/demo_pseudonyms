const SEED_STORAGE_KEY = "eudiw-pseudonym-seed";
const REGISTRY_STORAGE_KEY = "eudiw-nym-registry";
const REGISTRY_STORAGE_KEY_UNLINKED = "eudiw-nym-registry-unlinked";

function getSelectedRadioValue(groupName) {
  const radios = document.querySelectorAll(
    `input[name="${groupName}"]:checked`
  );
  return radios.length > 0 ? radios[0].value : null;
}

function populateDomainOptions(registryType) {
  const container = document.getElementById("domain-options");
  container.innerHTML = "";

  const domains = new Set();

  if (registryType === "linked") {
    const registry = JSON.parse(
      sessionStorage.getItem(REGISTRY_STORAGE_KEY) || "{}"
    );
    for (const domain of Object.keys(registry.siteRegistry || {})) {
      domains.add(domain);
    }
  } else {
    const registry = JSON.parse(
      sessionStorage.getItem(REGISTRY_STORAGE_KEY_UNLINKED) || "{}"
    );
    for (const entry of Object.values(registry.indexRegistry || {})) {
      domains.add(entry.domain);
    }
  }

  for (const domain of [...domains].sort()) {
    const id = `domain-${registryType}-${domain}`;
    container.innerHTML += `
      <label><input type="radio" name="domain" value="${domain}" id="${id}"> ${domain}</label>
    `;
  }
}

function populateAliasOptions(registryType, domain) {
  const container = document.getElementById("alias-options");
  container.innerHTML = "";

  const aliases = [];

  if (registryType === "linked") {
    const registry = JSON.parse(
      sessionStorage.getItem(REGISTRY_STORAGE_KEY) || "{}"
    );
    aliases.push(...(registry.siteRegistry?.[domain] || []));
  } else {
    const registry = JSON.parse(
      sessionStorage.getItem(REGISTRY_STORAGE_KEY_UNLINKED) || "{}"
    );
    for (const entry of Object.values(registry.indexRegistry || {})) {
      if (entry.domain === domain) {
        aliases.push(entry.alias);
      }
    }
  }

  for (const alias of aliases.sort()) {
    const id = `alias-${registryType}-${alias}`;
    container.innerHTML += `
      <label><input type="radio" name="alias" value="${alias}" id="${id}"> ${alias}</label>
    `;
  }
}

async function derivePseudonym(seedHex, index) {
  const encoder = new TextEncoder();
  const keyBytes = Uint8Array.from(
    seedHex.match(/.{2}/g).map((b) => parseInt(b, 16))
  );
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const message = encoder.encode(index.toString());
  const signature = await crypto.subtle.sign("HMAC", key, message);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32); // truncate to 128-bit pseudonym
}

async function generatePseudonym() {
  const registryType = getSelectedRadioValue("registry-type");
  const domain = getSelectedRadioValue("domain");
  const alias = getSelectedRadioValue("alias");
  const seed = sessionStorage.getItem(SEED_STORAGE_KEY);

  if (!seed) {
    alert("No seed available. Please generate it first.");
    return;
  }

  if (!domain || !alias) {
    alert("Please select both a domain and an alias.");
    return;
  }

  let index = null;

  if (registryType === "linked") {
    const registry = JSON.parse(
      sessionStorage.getItem(REGISTRY_STORAGE_KEY) || "{}"
    );
    index = registry.aliasRegistry?.[alias];
  } else {
    const registry = JSON.parse(
      sessionStorage.getItem(REGISTRY_STORAGE_KEY_UNLINKED) || "{}"
    );
    for (const [idx, entry] of Object.entries(registry.indexRegistry || {})) {
      if (entry.domain === domain && entry.alias === alias) {
        index = parseInt(idx, 10);
        break;
      }
    }
  }

  if (index === null || index === undefined) {
    alert("Failed to resolve index for the selected alias.");
    return;
  }

  const pseudonym = await derivePseudonym(seed, index);
  document.getElementById("pseudonym-output").value = pseudonym;
}

function generateSeed() {
  let seed = "";
  for (let i = 0; i < 32; i++) {
    const byte = Math.floor(Math.random() * 256);
    seed += byte.toString(16).padStart(2, "0");
  }
  seed = seed.toUpperCase();
  sessionStorage.setItem(SEED_STORAGE_KEY, seed);
  document.getElementById("seed-display").value = seed;
  console.log("Demo seed generated:", seed);
}

function loadSeed() {
  const seed = sessionStorage.getItem(SEED_STORAGE_KEY) || "";
  document.getElementById("seed-display").value = seed;
}

function loadRegistryLinked() {
  const registry = JSON.parse(
    sessionStorage.getItem(REGISTRY_STORAGE_KEY) ||
      '{"siteRegistry": {}, "aliasRegistry": {}, "indexRegistry": {}}'
  );

  const siteTableBody = document.querySelector(
    "#site-registry-table-linked tbody"
  );
  const aliasTableBody = document.querySelector(
    "#alias-registry-table-linked tbody"
  );

  siteTableBody.innerHTML = "";
  aliasTableBody.innerHTML = "";

  for (const [domain, aliases] of Object.entries(registry.siteRegistry)) {
    const row = document.createElement("tr");
    const domainCell = document.createElement("td");
    const aliasesCell = document.createElement("td");
    domainCell.textContent = domain;
    aliasesCell.textContent = aliases.join(", ");
    row.appendChild(domainCell);
    row.appendChild(aliasesCell);
    siteTableBody.appendChild(row);
  }

  for (const [alias, index] of Object.entries(registry.aliasRegistry)) {
    const row = document.createElement("tr");
    const aliasCell = document.createElement("td");
    const indexCell = document.createElement("td");
    aliasCell.textContent = alias;
    indexCell.textContent = index;
    row.appendChild(aliasCell);
    row.appendChild(indexCell);
    aliasTableBody.appendChild(row);
  }
}

function loadRegistryUnlinked() {
  const raw = sessionStorage.getItem(REGISTRY_STORAGE_KEY_UNLINKED);
  const registry = raw ? JSON.parse(raw) : { indexRegistry: {} };

  const tableBody = document.querySelector(
    "#site-registry-table-unlinked tbody"
  );
  tableBody.innerHTML = "";

  for (const [index, { domain, alias }] of Object.entries(
    registry.indexRegistry
  )) {
    const row = document.createElement("tr");

    const domainCell = document.createElement("td");
    const indexCell = document.createElement("td");
    const aliasCell = document.createElement("td");

    domainCell.textContent = domain;
    indexCell.textContent = index;
    aliasCell.textContent = alias;

    row.appendChild(domainCell);
    row.appendChild(indexCell);
    row.appendChild(aliasCell);

    tableBody.appendChild(row);
  }
}

function registerAliasLinked() {
  const domain = document
    .getElementById("domain-input-linked")
    .value.trim()
    .toLowerCase();
  const alias = document.getElementById("alias-input-linked").value.trim();

  if (!domain || !alias) return;

  const registry = JSON.parse(
    sessionStorage.getItem(REGISTRY_STORAGE_KEY) ||
      '{"siteRegistry": {}, "aliasRegistry": {}, "indexRegistry": {}}'
  );

  if (!registry.siteRegistry[domain]) registry.siteRegistry[domain] = [];
  if (!registry.siteRegistry[domain].includes(alias))
    registry.siteRegistry[domain].push(alias);

  if (registry.aliasRegistry[alias] === undefined) {
    const existingIndexes = Object.values(registry.aliasRegistry).map(Number);
    const nextIndex = existingIndexes.length
      ? Math.max(...existingIndexes) + 1
      : 0;
    registry.aliasRegistry[alias] = nextIndex;
    registry.indexRegistry[nextIndex] = alias;
  }

  sessionStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry));
  loadRegistryLinked();

  document.getElementById("domain-input-linked").value = "";
  document.getElementById("alias-input-linked").value = "";
}

function registerAliasUnlinked() {
  const domainInput = document.getElementById("domain-input-unlinked");
  const aliasInput = document.getElementById("alias-input-unlinked");
  const domain = domainInput.value.trim().toLowerCase();
  const alias = aliasInput.value.trim();

  if (!domain || !alias) {
    alert("You must provide both domain and alias");
    return;
  }

  const raw = sessionStorage.getItem(REGISTRY_STORAGE_KEY_UNLINKED);
  const registry = raw ? JSON.parse(raw) : { indexRegistry: {} };

  for (const entry of Object.values(registry.indexRegistry)) {
    if (entry.domain === domain && entry.alias === alias) {
      alert(`Alias "${alias}" is already registered for "${domain}".`);
      return;
    }
  }

  const existingIndexes = Object.keys(registry.indexRegistry)
    .map((k) => parseInt(k, 10))
    .filter((n) => !isNaN(n));

  const nextIndex = existingIndexes.length
    ? Math.max(...existingIndexes) + 1
    : 0;

  registry.indexRegistry[nextIndex] = { domain, alias };

  sessionStorage.setItem(
    REGISTRY_STORAGE_KEY_UNLINKED,
    JSON.stringify(registry)
  );
  loadRegistryUnlinked();

  domainInput.value = "";
  aliasInput.value = "";
}

function resetAll() {
  sessionStorage.clear();
  console.log("All sessionStorage cleared.");
  location.href = location.href;
}

function toggleRegistryVisibilityLinked() {
  const el = document.getElementById("registry-display-linked");
  const btn = document.getElementById("toggle-registry-button-linked");
  const isHidden = el.style.display === "none";
  el.style.display = isHidden ? "block" : "none";
  btn.textContent = isHidden ? "Hide Registry" : "Show Registry";
}

function toggleRegistryVisibilityUnlinked() {
  const el = document.getElementById("registry-display-unlinked");
  const btn = document.getElementById("toggle-registry-button-unlinked");
  const isHidden = el.style.display === "none";
  el.style.display = isHidden ? "block" : "none";
  btn.textContent = isHidden ? "Hide Registry" : "Show Registry";
}

window.onload = () => {
  loadSeed();
  loadRegistryLinked();
  loadRegistryUnlinked();

  document
    .getElementById("generate-seed-button")
    .addEventListener("click", generateSeed);
  document
    .getElementById("register-alias-button-linked")
    .addEventListener("click", registerAliasLinked);
  document
    .getElementById("register-alias-button-unlinked")
    .addEventListener("click", registerAliasUnlinked);
  document.getElementById("reset-button").addEventListener("click", resetAll);
  document
    .getElementById("toggle-registry-button-linked")
    .addEventListener("click", toggleRegistryVisibilityLinked);
  document
    .getElementById("toggle-registry-button-unlinked")
    .addEventListener("click", toggleRegistryVisibilityUnlinked);
  document
    .getElementById("alias-options")
    .addEventListener("change", (event) => {
      if (event.target && event.target.name === "alias") {
        const registryType = getSelectedRadioValue("registry-type");
        const domain = getSelectedRadioValue("domain");
        const alias = getSelectedRadioValue("alias");
        if (domain && alias) {
          generatePseudonym();
        }
      }
    });

  // Init default registry type and populate domains
  const defaultType = "linked";
  document.querySelector(
    `input[name="registry-type"][value="${defaultType}"]`
  ).checked = true;
  populateDomainOptions(defaultType);

  document.querySelectorAll("input[name='registry-type']").forEach((radio) =>
    radio.addEventListener("change", () => {
      const registryType = getSelectedRadioValue("registry-type");
      populateDomainOptions(registryType);
      document.getElementById("alias-options").innerHTML = "";
    })
  );

  document
    .getElementById("domain-options")
    .addEventListener("change", (event) => {
      if (event.target && event.target.name === "domain") {
        const registryType = getSelectedRadioValue("registry-type");
        const domain = getSelectedRadioValue("domain");
        populateAliasOptions(registryType, domain);
      }
    });
};
