(function () {
  const apiKeyEl = document.getElementById("apiKey");
  const modelEl = document.getElementById("model");
  const saveBtn = document.getElementById("save");
  const statusEl = document.getElementById("status");

  async function load() {
    const settings = await CKStorage.getSettings();
    apiKeyEl.value = settings.apiKey || "";
    modelEl.value = settings.model || "";
  }

  async function save() {
    await CKStorage.saveSettings({
      apiKey: apiKeyEl.value.trim(),
      model: modelEl.value.trim(),
    });
    statusEl.textContent = "Saved.";
    setTimeout(() => (statusEl.textContent = ""), 2000);
  }

  saveBtn.addEventListener("click", save);
  load();
})();
