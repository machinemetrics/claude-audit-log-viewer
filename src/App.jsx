import React, { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import FileUpload from "./components/FileUpload";

const App = () => {
  const [fileUploaded, setFileUploaded] = useState(false);
  const [fileData, setFileData] = useState(null);

  const handleFileUpload = (data) => {
    console.log("Received file data in App component:", data.length, "records");
    if (data && data.length > 0) {
      setFileData(data);
      setFileUploaded(true);
    } else {
      console.error("No data received from file upload");
    }
  };

  // If we have fileData but fileUploaded is false, correct it
  useEffect(() => {
    if (fileData && !fileUploaded) {
      setFileUploaded(true);
    }
  }, [fileData, fileUploaded]);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Claude Audit Log Viewer
          </h1>
        </div>
      </header>
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {!fileUploaded ? (
            <FileUpload onFileUpload={handleFileUpload} />
          ) : (
            <Dashboard fileData={fileData} />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
