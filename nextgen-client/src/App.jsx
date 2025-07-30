// App.jsx
import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { Route, Routes } from "react-router-dom";
import Aurora from "./components/widgets/effects/Aurora";
import { ThemeProvider } from "./context/ThemeContext";
import ClientLayout from "./layouts/ClientLayout/ClientLayout";
import { fetchProfile } from "./store/features/auth/authSlice";
import { fetchProducts } from "./store/features/products/productSlice";

function App() {
  const dispatch = useDispatch();
  const { user, loading, isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    const checkAuth = async () => {
      if (!user && !loading && isAuthenticated) {
        await dispatch(fetchProfile());
      }
    };
    checkAuth();
  }, [dispatch, user, loading, isAuthenticated]);

  useEffect(() => {
    dispatch(fetchProducts());
  }, [dispatch]);

  return (
    <>
      {/* Toaster with custom theme */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: "12px",
            padding: "14px 20px",
            fontSize: "15px",
            fontWeight: "500",
            background: "#fefefe",
            color: "#333",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          },
          success: {
            iconTheme: {
              primary: "#516349", // tone dự án
              secondary: "#ffffff",
            },
            style: {
              background: "#f0f9f5",
              color: "#2c3e50",
              border: "1px solid #cce3d8",
            },
          },
          error: {
            iconTheme: {
              primary: "#e74c3c",
              secondary: "#ffffff",
            },
            style: {
              background: "#fff0f0",
              color: "#842029",
              border: "1px solid #f5c2c7",
            },
          },
          loading: {
            style: {
              background: "#fdfdfd",
              color: "#555",
              border: "1px solid #ddd",
            },
          },
        }}
      />

      <MainApp />
    </>
  );
}

function MainApp() {
  return (
    <ThemeProvider>
      <Aurora
        colorStops={["#3A29FF", "#FF94B4", "#FF3232"]}
        blend={0.5}
        amplitude={1.0}
        speed={0.5}
      />
      <Routes>
        <Route path="/*" element={<ClientLayout />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
