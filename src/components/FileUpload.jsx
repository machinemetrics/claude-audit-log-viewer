import React, { useState, useEffect } from "react";
import { Upload } from "lucide-react";
import JSZip from "jszip";

const FileUpload = ({ onFileUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [processedData, setProcessedData] = useState([]);

  const EXPECTED_FILES = ["conversations.json", "projects.json", "users.json"];

  // Monitor uploadedFiles changes and check if all required files are uploaded
  useEffect(() => {
    if (uploadedFiles.length > 0) {
      checkAllFilesUploaded();
    }
  }, [uploadedFiles]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      Array.from(files).forEach((file) => {
        processFile(file);
      });
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      Array.from(files).forEach((file) => {
        processFile(file);
      });
    }
  };

  const processFile = (file) => {
    // Check if the file is a zip file
    const isZip = file.type === "application/zip" || file.name.endsWith(".zip");

    // Check if the file is a JSON file
    const isJSON =
      file.type === "application/json" || file.name.endsWith(".json");

    if (isZip) {
      processZipFile(file);
      return;
    }

    if (!isJSON) {
      setError("Please upload JSON or ZIP files only");
      return;
    }

    // Check if file already uploaded
    if (uploadedFiles.includes(file.name)) {
      setError(`File ${file.name} already uploaded`);
      return;
    }

    setIsLoading(true);
    setError(null);

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const fileData = event.target.result;

        // Process JSON file
        processJSONFile(file, uploadedFiles);
      } catch (error) {
        setError(`Error reading file ${file.name}: ${error.message}`);
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setError(`Error reading the file ${file.name}`);
      setIsLoading(false);
    };

    reader.readAsText(file);
  };

  const processJSONFile = (file, uploadedFilesCopy) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        // Parse JSON
        const jsonData = JSON.parse(event.target.result);

        // Handle special case for users.json
        if (file.name === "users.json") {
          console.log("Processing users.json with specific format...");

          // Based on the format provided:
          // [{"uuid":"...","full_name":"...","email_address":"...","verified_phone_number":"..."}]
          const processedUserData = jsonData.map((user) => {
            // Ensure we have consistent field names for the dashboard
            return {
              uuid: user.uuid,
              full_name: user.full_name,
              name: user.full_name, // Map to name for consistency
              userName: user.full_name, // Map to userName for backward compatibility
              email_address: user.email_address,
              email: user.email_address, // Map to email for consistency
              verified_phone_number: user.verified_phone_number,
              phone: user.verified_phone_number,
              source: "users.json",
              // Don't set a default date for users, let their last activity determine this
            };
          });

          console.log(
            `Processed ${processedUserData.length} user records from users.json`
          );

          // Update state - make sure we're consistently working with arrays
          setProcessedData((prevData) => [...prevData, ...processedUserData]);

          // Mark file as uploaded
          setUploadedFiles((prev) => [...prev, file.name]);
          setIsLoading(false);

          // Check if all files are uploaded
          checkAllFilesUploaded();
        } else if (file.name === "conversations.json") {
          // Special handling for conversations.json with the format provided by the user
          console.log("Processing conversations.json with specific format...");

          let processedFileData = [];

          // Check if it's an array
          if (Array.isArray(jsonData)) {
            processedFileData = jsonData.map((item) => {
              // Extract the account UUID if available
              let userUuid = "";
              if (item.account && item.account.uuid) {
                userUuid = item.account.uuid;
              }

              // Process the date - handle future dates by using created_at instead of updated_at
              let itemDate;
              if (item.created_at) {
                // Parse the date from created_at (more reliable than updated_at)
                itemDate = new Date(item.created_at);
                console.log(
                  `Parsed conversation date: ${itemDate.toISOString()}`
                );
              } else {
                // Fallback to timestamp or current date
                itemDate = new Date(item.timestamp || item.date || Date.now());
              }

              console.log(`Conversation date: ${itemDate.toISOString()}`);

              return {
                ...item,
                // Store the user UUID so we can link it later
                user_uuid: userUuid,
                source: file.name,
                date: itemDate,
                dateStr: itemDate.toISOString().split("T")[0],
              };
            });
          } else {
            // Handle non-array JSON
            processedFileData = [
              {
                ...jsonData,
                source: file.name,
                date: new Date(),
                dateStr: new Date().toISOString().split("T")[0],
              },
            ];
          }

          console.log(
            `Processed ${processedFileData.length} records from ${file.name}`
          );

          // Update state - use arrays consistently
          setProcessedData((prevData) => [...prevData, ...processedFileData]);

          // Mark file as uploaded
          setUploadedFiles((prev) => [...prev, file.name]);
          setIsLoading(false);

          // Check if all files are uploaded
          checkAllFilesUploaded();
        } else if (file.name === "projects.json") {
          // Special handling for projects.json with the format provided by the user
          console.log("Processing projects.json with specific format...");

          let processedFileData = [];

          // Check if it's an array
          if (Array.isArray(jsonData)) {
            processedFileData = jsonData.map((item) => {
              // Projects might not have account info directly like conversations do
              // But they may contain user information we can extract from the content
              let userUuid = "";

              // Process the date from created_at field
              let itemDate;
              if (item.created_at) {
                itemDate = new Date(item.created_at);
                console.log(`Parsed project date: ${itemDate.toISOString()}`);
              } else {
                // Fallback to timestamp or current date
                itemDate = new Date(item.timestamp || item.date || Date.now());
              }

              console.log(`Project date: ${itemDate.toISOString()}`);

              // Extract creator information if available
              const creatorUuid = item.creator?.uuid || "";
              const creatorName = item.creator?.full_name || "";

              // Count documents if available - check both 'documents' and 'docs' arrays
              const documentCount =
                item.docs?.length || item.documents?.length || 0;

              return {
                ...item,
                // Keep original name if it exists, otherwise fallback to appropriate defaults
                name:
                  item.name ||
                  item.title ||
                  item.project_name ||
                  item.filename ||
                  "Unnamed Project",
                // Store creator information
                user_uuid: creatorUuid || userUuid,
                creator_name: creatorName,
                // Document count
                document_count: documentCount,
                source: file.name,
                event: "project_created", // Add event type for consistent filtering
                date: itemDate,
                dateStr: itemDate.toISOString().split("T")[0],
              };
            });
          } else {
            // Handle non-array JSON
            processedFileData = [
              {
                ...jsonData,
                source: file.name,
                date: new Date(),
                dateStr: new Date().toISOString().split("T")[0],
              },
            ];
          }

          console.log(
            `Processed ${processedFileData.length} records from ${file.name}`
          );

          // Update state - use arrays consistently
          setProcessedData((prevData) => [...prevData, ...processedFileData]);

          // Mark file as uploaded
          setUploadedFiles((prev) => [...prev, file.name]);
          setIsLoading(false);

          // Check if all files are uploaded
          checkAllFilesUploaded();
        } else {
          // Process other JSON files
          let processedFileData = [];

          // Check if it's an array
          if (Array.isArray(jsonData)) {
            processedFileData = jsonData.map((item) => {
              // Extract actor email information if available
              let email = item.email_address || item.email || "";
              let userName = item.full_name || item.userName || item.name || "";

              // For projects, try to extract from actor_info or similar fields
              try {
                if (item.actor_info) {
                  const actorInfo =
                    typeof item.actor_info === "string"
                      ? JSON.parse(item.actor_info.replace(/'/g, '"'))
                      : item.actor_info;

                  if (!email) {
                    email =
                      actorInfo?.metadata?.email_address ||
                      actorInfo?.email ||
                      item.actor?.email_address ||
                      item.actor?.email ||
                      "";
                  }

                  if (!userName) {
                    userName =
                      actorInfo?.name ||
                      actorInfo?.full_name ||
                      item.actor?.name ||
                      item.actor?.full_name ||
                      "";
                  }
                }

                // Check for "SECO Reconciliation service" and skip or modify as needed
                if (userName === "SECO Reconciliation service") {
                  // Skip this entry or assign it to a specific service account
                  console.log(
                    "Found SECO Reconciliation service entry, skipping attribution"
                  );
                  email = "service-account@system.internal";
                  userName = "System Service Account";
                }
              } catch (e) {
                console.error("Error processing actor info:", e);
              }

              return {
                ...item,
                email_address: email,
                email: email,
                full_name: userName,
                name: userName,
                userName: userName,
                source: file.name,
                date: new Date(
                  item.timestamp || item.created_at || item.date || Date.now()
                ),
                dateStr: new Date(
                  item.timestamp || item.created_at || item.date || Date.now()
                )
                  .toISOString()
                  .split("T")[0],
              };
            });
          } else {
            // Handle non-array JSON
            processedFileData = [
              {
                ...jsonData,
                source: file.name,
                date: new Date(),
                dateStr: new Date().toISOString().split("T")[0],
              },
            ];
          }

          console.log(
            `Processed ${processedFileData.length} records from ${file.name}`
          );

          // Update state - use arrays consistently
          setProcessedData((prevData) => [...prevData, ...processedFileData]);

          // Mark file as uploaded
          setUploadedFiles((prev) => [...prev, file.name]);
          setIsLoading(false);

          // Check if all files are uploaded
          checkAllFilesUploaded();
        }
      } catch (error) {
        console.error("Error parsing JSON:", error);
        setError(`Error parsing JSON: ${error.message}`);
        setIsLoading(false);
      }
    };

    reader.onerror = (error) => {
      console.error("File reading error:", error);
      setError("Error reading the file");
      setIsLoading(false);
    };

    reader.readAsText(file);
  };

  const processZipFile = (file) => {
    setIsLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(event.target.result);

        console.log(
          "Processing zip file with files:",
          Object.keys(zipContent.files)
        );

        // Track how many files we've processed
        let processedCount = 0;
        const totalFiles = Object.keys(zipContent.files).filter(
          (filename) => !zipContent.files[filename].dir
        ).length;

        // Process each file in the zip
        const promises = [];

        zipContent.forEach((relativePath, zipEntry) => {
          // Skip directories
          if (zipEntry.dir) return;

          // Check if this is one of our expected files
          const isExpectedFile = EXPECTED_FILES.some((expectedFile) =>
            relativePath.endsWith(expectedFile)
          );

          // Skip processing if file already uploaded
          if (uploadedFiles.includes(relativePath)) {
            console.log(`File ${relativePath} already uploaded, skipping`);
            processedCount++;
            return;
          }

          // Process the file
          const promise = zipEntry.async("string").then((content) => {
            try {
              // For JSON files
              if (relativePath.endsWith(".json")) {
                const jsonData = JSON.parse(content);

                // Determine which type of file this is
                if (
                  relativePath.includes("conversations") ||
                  relativePath.endsWith("conversations.json")
                ) {
                  processJsonContent(jsonData, "conversations.json");
                } else if (
                  relativePath.includes("projects") ||
                  relativePath.endsWith("projects.json")
                ) {
                  processJsonContent(jsonData, "projects.json");
                } else if (
                  relativePath.includes("users") ||
                  relativePath.endsWith("users.json")
                ) {
                  processJsonContent(jsonData, "users.json");
                } else {
                  // Generic JSON processing
                  processJsonContent(jsonData, relativePath);
                }
              }

              processedCount++;
              console.log(
                `Processed ${processedCount} of ${totalFiles} files from zip`
              );
            } catch (error) {
              console.error(
                `Error processing ${relativePath} from zip:`,
                error
              );
            }
          });

          promises.push(promise);
        });

        // Wait for all files to be processed
        await Promise.all(promises);

        console.log("Finished processing zip file");
        setIsLoading(false);

        // Check if we have all the files we need
        checkAllFilesUploaded();
      } catch (error) {
        console.error("Error processing zip file:", error);
        setError(`Error processing zip file: ${error.message}`);
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setError(`Error reading the zip file ${file.name}`);
      setIsLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  // Helper function to process JSON content from zip files
  const processJsonContent = (jsonData, filename) => {
    // Use the existing JSON processing logic based on filename
    if (filename === "users.json") {
      // Handle users.json
      const processedUserData = Array.isArray(jsonData)
        ? jsonData.map((user) => {
            return {
              uuid: user.uuid,
              full_name: user.full_name,
              name: user.full_name,
              userName: user.full_name,
              email_address: user.email_address,
              email: user.email_address,
              verified_phone_number: user.verified_phone_number,
              phone: user.verified_phone_number,
              source: "users.json",
            };
          })
        : [];

      setProcessedData((prevData) => [...prevData, ...processedUserData]);
      setUploadedFiles((prev) => [...prev, "users.json"]);
    } else if (filename === "conversations.json") {
      // Handle conversations.json
      let processedFileData = [];

      if (Array.isArray(jsonData)) {
        processedFileData = jsonData.map((item) => {
          // Extract the account UUID if available
          let userUuid = "";
          if (item.account && item.account.uuid) {
            userUuid = item.account.uuid;
          }

          // Process the date
          let itemDate;
          if (item.created_at) {
            itemDate = new Date(item.created_at);
          } else {
            itemDate = new Date(item.timestamp || item.date || Date.now());
          }

          return {
            ...item,
            user_uuid: userUuid,
            source: "conversations.json",
            date: itemDate,
            dateStr: itemDate.toISOString().split("T")[0],
            event: "conversation_created",
          };
        });
      } else if (jsonData) {
        processedFileData = [
          {
            ...jsonData,
            source: "conversations.json",
            date: new Date(),
            dateStr: new Date().toISOString().split("T")[0],
            event: "conversation_created",
          },
        ];
      }

      setProcessedData((prevData) => [...prevData, ...processedFileData]);
      setUploadedFiles((prev) => [...prev, "conversations.json"]);
    } else if (filename === "projects.json") {
      // Handle projects.json
      let processedFileData = [];

      if (Array.isArray(jsonData)) {
        processedFileData = jsonData.map((item) => {
          // Process the date
          let itemDate;
          if (item.created_at) {
            itemDate = new Date(item.created_at);
          } else {
            itemDate = new Date(item.timestamp || item.date || Date.now());
          }

          // Extract creator information
          const creatorUuid = item.creator?.uuid || "";
          const creatorName = item.creator?.full_name || "";

          // Count documents
          const documentCount =
            item.docs?.length || item.documents?.length || 0;

          return {
            ...item,
            name:
              item.name ||
              item.title ||
              item.project_name ||
              item.filename ||
              "Unnamed Project",
            user_uuid: creatorUuid,
            creator_name: creatorName,
            document_count: documentCount,
            source: "projects.json",
            event: "project_created",
            date: itemDate,
            dateStr: itemDate.toISOString().split("T")[0],
          };
        });
      } else if (jsonData) {
        processedFileData = [
          {
            ...jsonData,
            source: "projects.json",
            date: new Date(),
            dateStr: new Date().toISOString().split("T")[0],
            event: "project_created",
          },
        ];
      }

      setProcessedData((prevData) => [...prevData, ...processedFileData]);
      setUploadedFiles((prev) => [...prev, "projects.json"]);
    } else {
      // Generic JSON handling for other files
      let processedFileData = [];

      if (Array.isArray(jsonData)) {
        processedFileData = jsonData.map((item) => {
          return {
            ...item,
            source: filename,
            date: new Date(
              item.timestamp || item.created_at || item.date || Date.now()
            ),
            dateStr: new Date(
              item.timestamp || item.created_at || item.date || Date.now()
            )
              .toISOString()
              .split("T")[0],
          };
        });
      } else if (jsonData) {
        processedFileData = [
          {
            ...jsonData,
            source: filename,
            date: new Date(),
            dateStr: new Date().toISOString().split("T")[0],
          },
        ];
      }

      setProcessedData((prevData) => [...prevData, ...processedFileData]);
      setUploadedFiles((prev) => [...prev, filename]);
    }
  };

  const checkAllFilesUploaded = () => {
    console.log("Checking files:", uploadedFiles); // Debug logging

    // Check if we have all three required files or at least one file that's not in our expected list
    const allRequiredFilesUploaded =
      EXPECTED_FILES.every((file) => uploadedFiles.includes(file)) ||
      (uploadedFiles.length > 0 &&
        !EXPECTED_FILES.some((file) => uploadedFiles.includes(file)));

    if (allRequiredFilesUploaded) {
      console.log("All required files uploaded, sending data"); // Debug logging

      // If we have data, send it to the parent component
      if (processedData.length > 0) {
        console.log("Processed data length:", processedData.length); // Debug logging
        onFileUpload(processedData);
      }
    }
  };

  const getUploadStatus = () => {
    return EXPECTED_FILES.map((filename) => ({
      name: filename,
      uploaded: uploadedFiles.includes(filename),
    }));
  };

  const fileStatus = getUploadStatus();

  // Add debug information
  const allUploaded = EXPECTED_FILES.every((file) =>
    uploadedFiles.includes(file)
  );

  return (
    <div className="max-w-xl mx-auto bg-white rounded-lg shadow-md p-6">
      <div
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-blue-400"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById("file-upload").click()}
      >
        <input
          id="file-upload"
          type="file"
          accept=".json,.zip,application/json,application/zip"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Upload Audit Log Files</h3>
        <p className="text-sm text-gray-500 mb-2">
          Drag and drop your JSON or ZIP files here, or click to browse
        </p>
        <p className="text-xs text-gray-400 mb-4">
          Upload conversations.json, projects.json, users.json, or a ZIP file
          containing these files
        </p>

        {/* Instructions on how to export data from Claude */}
        <div className="mt-2 mb-4 p-4 bg-blue-50 rounded-md text-left">
          <h4 className="text-sm font-semibold text-blue-700 mb-2">
            How to export data from Claude:
          </h4>
          <ol className="text-xs text-blue-600 list-decimal pl-4 space-y-1">
            <li>Log in to your Claude account</li>
            <li>
              Go to <strong>Settings</strong> (usually found in the profile
              menu)
            </li>
            <li>
              Select <strong>Account</strong> tab
            </li>
            <li>
              Click on <strong>Export Data</strong>
            </li>
            <li>
              You will receive a download link in your email with a zip file
            </li>
            <li>Download and extract the zip file</li>
            <li>
              Upload either the zip file directly or the extracted files:
              <ul className="list-disc pl-4 mt-1">
                <li>
                  <strong>conversations.json</strong> - Contains conversation
                  history
                </li>
                <li>
                  <strong>projects.json</strong> - Contains project information
                </li>
                <li>
                  <strong>users.json</strong> - Contains user data
                </li>
              </ul>
            </li>
          </ol>
        </div>

        {/* File upload status */}
        <div className="mt-2 text-left">
          {fileStatus.map((file, index) => (
            <div key={index} className="flex items-center text-sm mb-1">
              <span
                className={`inline-block w-3 h-3 rounded-full mr-2 ${
                  file.uploaded ? "bg-green-500" : "bg-gray-300"
                }`}
              ></span>
              <span
                className={file.uploaded ? "text-green-600" : "text-gray-500"}
              >
                {file.name} {file.uploaded ? "(uploaded)" : ""}
              </span>
            </div>
          ))}
        </div>

        {allUploaded && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <button
              onClick={(e) => {
                e.stopPropagation();
                checkAllFilesUploaded();
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              View Dashboard
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="mt-4 p-3 bg-gray-100 text-gray-700 rounded-md flex items-center justify-center">
          <svg
            className="animate-spin h-5 w-5 mr-3 text-blue-500"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Processing file...
        </div>
      )}
    </div>
  );
};

export default FileUpload;
