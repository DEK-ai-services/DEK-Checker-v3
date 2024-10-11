import React from 'react';

// Vytvoøíme vıchozí hodnotu pro kontext
// Tato funkce nebude nic dìlat, pokud kontext není poskytnut
const defaultShowSnackbar = () => { };

// Vytvoøíme kontext
export const SnackbarContext = React.createContext(defaultShowSnackbar);

// Vytvoøíme custom hook pro snadné pouití kontextu
export const useSnackbar = () => React.useContext(SnackbarContext);

// Vytvoøíme provider komponentu
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