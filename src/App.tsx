import React, { useState, useRef, useCallback } from "react";
import {
  Upload,
  Image as ImageIcon,
  FileWarning,
  Check,
  RefreshCw,
  Download,
} from "lucide-react";
import sizefotologo from "./images/sizephotologo.png";


function App() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [minSize, setMinSize] = useState<number>(50);
  const [maxSize, setMaxSize] = useState<number>(100);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [processedSize, setProcessedSize] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Check if the file is an image
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file");
        return;
      }

      setImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target) {
          setPreview(event.target.result as string);
          setProcessedImage(null);
          setProcessedSize(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const calculateImageSize = (dataUrl: string): number => {
    // Remove the metadata part of the data URL to get just the base64 data
    const base64 = dataUrl.split(",")[1];
    // Calculate size in bytes and convert to KB
    return Math.round((base64.length * 3) / 4 / 1024);
  };

  const processImage = useCallback(async () => {
    if (!image || !preview) {
      setError("Please upload an image first");
      return;
    }

    if (minSize >= maxSize) {
      setError("Minimum size must be less than maximum size");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create an image element to draw to canvas
      const img = new Image();
      img.src = preview;

      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // Start with original dimensions
      let width = img.width;
      let height = img.height;
      let quality = 0.9;
      let currentSize = 0;
      let dataUrl = "";
      let attempts = 0;
      const maxAttempts = 20; // Increased max attempts

      // Create canvas
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      // First, check the original size
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      const originalDataUrl = canvas.toDataURL("image/jpeg", 1.0);
      const originalSize = calculateImageSize(originalDataUrl);

      // If original is already smaller than minSize, try to increase
      if (originalSize < minSize) {
        // Try increasing dimensions to meet minimum size
        let scaleFactor = 1.0;
        while (currentSize < minSize && scaleFactor < 3.0) {
          // Limit scale factor to prevent excessive enlargement
          scaleFactor += 0.2;
          canvas.width = Math.floor(width * scaleFactor);
          canvas.height = Math.floor(height * scaleFactor);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL("image/jpeg", 1.0); // Use max quality
          currentSize = calculateImageSize(dataUrl);

          if (currentSize >= minSize) {
            break;
          }
        }

        // If we still can't reach minSize, use the best we have
        if (currentSize < minSize) {
          setProcessedImage(dataUrl);
          setProcessedSize(currentSize);
          setError(
            `Could not reach minimum size of ${minSize}KB. Best result: ${currentSize}KB`
          );
          setLoading(false);
          return;
        }
      }

      // If original is larger than maxSize, reduce it
      if (originalSize > maxSize) {
        // Reset canvas to original dimensions
        canvas.width = width;
        canvas.height = height;

        // Binary search approach to find the right quality
        let minQuality = 0.001; // Start with very low quality
        let maxQuality = 100.00;
        quality = 0.7; // Start with a moderate quality

        while (attempts < maxAttempts) {
          attempts++;

          // Draw image to canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to data URL with current quality
          dataUrl = canvas.toDataURL("image/jpeg", quality);

          // Calculate size
          currentSize = calculateImageSize(dataUrl);

          // Check if we're within the desired range
          if (currentSize <= maxSize && currentSize >= minSize) {
            break;
          }

          // Adjust quality using binary search
          if (currentSize > maxSize) {
            // Too big, reduce quality
            maxQuality = quality;
            quality = (minQuality + quality) / 2;
          } else if (currentSize < minSize) {
            // Too small, increase quality
            minQuality = quality;
            quality = (quality + maxQuality) / 2;
          }

          // If we're stuck and can't get below maxSize with quality adjustments
          if (attempts > 10 && currentSize > maxSize) {
            // Reduce dimensions by 10% and reset quality search
            width = Math.floor(width * 0.9);
            height = Math.floor(height * 0.9);
            canvas.width = width;
            canvas.height = height;
            minQuality = 0.01;
            maxQuality = 0.7; // Lower max quality to ensure size reduction
            quality = 0.3;
          }
        }

        // If we still can't get below maxSize, force it by reducing dimensions drastically
        if (currentSize > maxSize) {
          let scaleFactor = 0.9;
          while (currentSize > maxSize && scaleFactor > 0.1) {
            // Don't go below 10% of original size
            scaleFactor -= 0.1;
            width = Math.floor(img.width * scaleFactor);
            height = Math.floor(img.height * scaleFactor);

            canvas.width = width;
            canvas.height = height;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, width, height);

            // Use lowest quality
            dataUrl = canvas.toDataURL("image/jpeg", 0.1);
            currentSize = calculateImageSize(dataUrl);

            if (currentSize <= maxSize) {
              break;
            }
          }
        }
      } else {
        // Original is within range, just use it
        dataUrl = originalDataUrl;
        currentSize = originalSize;
      }

      // Set the processed image
      setProcessedImage(dataUrl);
      setProcessedSize(currentSize);

      // Provide feedback if we couldn't achieve the exact range
      if (currentSize < minSize) {
        setError(
          `Could not reach minimum size of ${minSize}KB. Best result: ${currentSize}KB`
        );
      } else if (currentSize > maxSize) {
        setError(
          `Could not get below maximum size of ${maxSize}KB. Best result: ${currentSize}KB`
        );
      }
    } catch (err) {
      setError(
        "Error processing image: " +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setLoading(false);
    }
  }, [image, preview, minSize, maxSize]);

  const resetForm = () => {
    setImage(null);
    setPreview(null);
    setProcessedImage(null);
    setProcessedSize(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const downloadImage = () => {
    if (processedImage) {
      const link = document.createElement("a");
      link.href = processedImage;
      link.download = `resized-${image?.name || "image.jpg"}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-center mb-6">
            <img
              src={sizefotologo}
              alt="Logo"
              className="h-auto w-[200px] mr-2"
            />
          </div>

          <p className="text-gray-600 mb-8 text-center">
            Upload a photo and specify the desired size range in KB. We'll
            adjust it for you!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  Upload Image
                </label>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-10 w-10 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    PNG, JPG, JPEG up to 10MB
                  </p>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                    ref={fileInputRef}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="min-size"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Minimum Size (KB)
                  </label>
                  <input
                    id="min-size"
                    type="text"
                    // min="1"
                    // value={minSize}
                    onChange={(e) =>
                      setMinSize(Math.max('', parseInt(e.target.value) || ''))
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                    placeholder="Enter the minimum size in KB"
                  />
                </div>

                <div>
                  <label
                    htmlFor="max-size"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Maximum Size (KB)
                  </label>
                  <input
                    id="max-size"
                    type="text"
                    // min={minSize + 1}
                    // value={maxSize}
                    onChange={(e) =>
                      setMaxSize(
                        Math.max('', parseInt(e.target.value) || '')
                      )
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                    placeholder="Enter the minimum size in KB"
                    
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={processImage}
                  disabled={!image || loading}
                  className={`flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    !image || loading
                      ? "bg-indigo-300"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center justify-center`}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                      Processing...
                    </>
                  ) : (
                    "Process Image"
                  )}
                </button>

                <button
                  onClick={resetForm}
                  className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Reset
                </button>
              </div>

              {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 flex items-start">
                  <FileWarning className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {processedImage && processedSize && (
                <div className="bg-green-50 border-l-4 border-green-400 p-4 flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-green-700">
                      Image processed successfully! Size: {processedSize}KB
                    </p>
                    <button
                      onClick={downloadImage}
                      className="mt-3 flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Image
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  {preview ? "Original Image" : "Image Preview"}
                </h3>
                <div className="border rounded-lg overflow-hidden bg-gray-50 h-48 flex items-center justify-center">
                  {preview ? (
                    <img
                      src={preview}
                      alt="Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <p className="text-gray-400 text-sm">No image uploaded</p>
                  )}
                </div>
                {image && (
                  <p className="text-xs text-gray-500 mt-1">
                    Original size: {Math.round(image.size / 1024)}KB
                  </p>
                )}
              </div>

              {processedImage && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Processed Image
                  </h3>
                  <div className="border rounded-lg overflow-hidden bg-gray-50 h-48 flex items-center justify-center">
                    <img
                      src={processedImage}
                      alt="Processed"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  {processedSize && (
                    <p className="text-xs text-gray-500 mt-1">
                      Processed size: {processedSize}KB
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
