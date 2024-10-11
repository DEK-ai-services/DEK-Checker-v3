import React from 'react';

// Vytvo��me v�choz� hodnotu pro kontext
// Tato funkce nebude nic d�lat, pokud kontext nen� poskytnut
const defaultShowSnackbar = () => { };

// Vytvo��me kontext
export const SnackbarContext = React.createContext(defaultShowSnackbar);

// Vytvo��me custom hook pro snadn� pou�it� kontextu
export const useSnackbar = () => React.useContext(SnackbarContext);

// Vytvo��me provider komponentu
export const SnackbarProvider = ({ children }) => {
    const [snackbar, setSnackbar] = React.useState({
        open: false,
        message: '',
        severity: 'info',
    });

    const showSnackbar = React.useCallback((message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
    }, []);

    const handleClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setSnackbar((prev) => ({ ...prev, open: false }));
    };

    return (
        <SnackbarContext.Provider value={showSnackbar}>
            {children}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleClose} severity={snackbar.severity}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </SnackbarContext.Provider>
    );
};