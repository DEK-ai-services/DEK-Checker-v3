import React, { useState, useEffect, useCallback, createContext } from "react";
import { createRoot } from "react-dom/client";
import { Paper, Snackbar } from "@mui/material";
import { Alert } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { styled } from "@mui/system";

import HomePage from "./HomePage";
import AIChecker from "./AIChecker";
import TextChecker from "./TextChecker";
import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css";

export const SnackbarContext = createContext();

const theme = createTheme();

const StyledPaper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(2),
    margin: theme.spacing(2),
}));

const App = () => {
    const [sheets, setSheets] = useState([]);
    const [selectedSheetId, setSelectedSheetId] = useState(null);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: "",
        severity: "info",
    });
    const [isTextCheckerOpen, setIsTextCheckerOpen] = useState(false);

    useEffect(() => {
        fetchSheets();
    }, []);

    const fetchSheets = async () => {
        try {
            const response = await fetch("/get-saved-sheets");
            const data = await response.json();
            setSheets(data);
        } catch (error) {
            console.error("Error fetching sheets:", error);
            showSnackbar(
                "Nepodařilo se načíst uložené tabulky. Zkuste to prosím znovu.",
                "error"
            );
        }
    };

    const handleAddSheet = async (sheetData) => {
        try {
            const response = await fetch("/add_sheet", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(sheetData),
            });
            const data = await response.json();
            if (data.status === "success") {
                await fetchSheets();
                showSnackbar("Tabulka byla úspěšně přidána!", "success");
            } else {
                showSnackbar(
                    "Chyba při přidávání tabulky: " + data.message,
                    "error"
                );
            }
        } catch (error) {
            console.error("Error adding sheet:", error);
            showSnackbar(
                "Nepodařilo se přidat tabulku. Zkontrolujte zadané údaje a zkuste to znovu.",
                "error"
            );
        }
    };

    const handleSelectSheet = (sheetId) => {
        setSelectedSheetId(sheetId);
        showSnackbar("Tabulka byla úspěšně načtena.", "success");
    };

    const showSnackbar = useCallback((message, severity = "info") => {
        setSnackbar({ open: true, message, severity });
    }, []);

    const handleCloseSnackbar = (event, reason) => {
        if (reason === "clickaway") {
            return;
        }
        setSnackbar({ ...snackbar, open: false });
    };

    const handleOpenTextChecker = () => {
        setIsTextCheckerOpen(true);
    };

    const handleCloseTextChecker = () => {
        setIsTextCheckerOpen(false);
    };

    return (
        <ThemeProvider theme={theme}>
            <SnackbarContext.Provider value={showSnackbar}>
                <StyledPaper>
                    {isTextCheckerOpen ? (
                        <TextChecker onClose={handleCloseTextChecker} />
                    ) : selectedSheetId ? (
                        <AIChecker
                            sheetId={selectedSheetId}
                            onBack={() => setSelectedSheetId(null)}
                        />
                    ) : (
                        <HomePage
                            sheets={0}
                            onSelectSheet={handleSelectSheet}
                            onAddSheet={handleAddSheet}
                            onCheckText={handleOpenTextChecker}
                        />
                    )}
                    <Snackbar
                        open={snackbar.open}
                        autoHideDuration={6000}
                        onClose={handleCloseSnackbar}
                        anchorOrigin={{
                            vertical: "bottom",
                            horizontal: "center",
                        }}
                    >
                        <Alert
                            onClose={handleCloseSnackbar}
                            severity={snackbar.severity}
                        >
                            {snackbar.message}
                        </Alert>
                    </Snackbar>
                </StyledPaper>
            </SnackbarContext.Provider>
        </ThemeProvider>
    );
};

export default App;
