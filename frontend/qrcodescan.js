document.getElementById("validate-qr-button").addEventListener("click", async () => {
  const fileInput = document.getElementById("qr-file-input");
  const resultDiv = document.getElementById("qr-result");

  if (!fileInput.files[0]) {
    resultDiv.textContent = "Please select an image first.";
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async function (event) {
    const img = new Image();
    img.src = event.target.result;

    img.onload = async function () {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0, img.width, img.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // decode QR
      const qr = jsQR(imageData.data, canvas.width, canvas.height);
      if (!qr) {
        resultDiv.textContent = "Could not read QR code.";
        return;
      }

      // Send decoded text to backend
      try {
        const response = await fetch("/validate-ticket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrData: qr.data })
        });

        const data = await response.json();
        resultDiv.textContent = data.message;

      } catch (err) {
        resultDiv.textContent = "Server error validating QR code.";
      }
    };
  };

  reader.readAsDataURL(file);
});
