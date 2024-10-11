import React, { useState } from 'react';
import {
    Button, Dialog, DialogTitle, DialogContent, List, ListItem, ListItemText,
    TextField, Typography, Box, IconButton, InputAdornment, Fade
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { makeStyles } from '@mui/styles';
import { Search, Add, TextFields, TableChart } from '@mui/icons-material';
import TextChecker from './TextChecker';
const defaultTheme = createTheme();
const theme = createTheme({
    palette: {
        primary: {
            main: '#1976d2', // Nahraďte barvou DEK
        },
        secondary: {
            main: '#dc004e', // Nahraďte sekundární barvou DEK
        },
    },
});

const useStyles = makeStyles((theme) => ({
    root: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing(2),
    },
    logo: {
        width: 200,
        marginBottom: theme.spacing(2),
    },
    slogan: {
        marginBottom: theme.spacing(4),
        textAlign: 'center',
    },
    buttonContainer: {
        display: 'flex',
        justifyContent: 'center',
        gap: theme.spacing(2),
        marginBottom: theme.spacing(4),
    },
    button: {
        width: 200,
        height: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s',
        '&:hover': {
            transform: 'translateY(-5px)',
        },
    },
    icon: {
        fontSize: 40,
        marginBottom: theme.spacing(1),
    },
    dialogContent: {
        minWidth: 300,
    },
    searchField: {
        marginBottom: theme.spacing(2),
    },
    dropZone: {
        border: `2px dashed ${theme.palette.primary.main}`,
        borderRadius: theme.shape.borderRadius,
        padding: theme.spacing(2),
        textAlign: 'center',
        cursor: 'pointer',
        marginTop: theme.spacing(2),
    },
}), { defaultTheme });

const HomePage = ({ sheets, onSelectSheet, onAddSheet }) => {
    const classes = useStyles();
    const [catalogOpen, setCatalogOpen] = useState(false);
    const [newSheetName, setNewSheetName] = useState('');
    const [newSheetUrl, setNewSheetUrl] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isTextCheckerOpen, setIsTextCheckerOpen] = useState(false);

    const handleCatalogOpen = () => setCatalogOpen(true);
    const handleCatalogClose = () => setCatalogOpen(false);

    const handleAddSheet = (e) => {
        e.preventDefault();
        onAddSheet({ name: newSheetName, url: newSheetUrl });
        setNewSheetName('');
        setNewSheetUrl('');
        handleCatalogClose();
    };

    const filteredSheets = sheets.filter(sheet =>
        sheet.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleOpenTextChecker = () => {
        setIsTextCheckerOpen(true);
    };

    const handleCloseTextChecker = () => {
        setIsTextCheckerOpen(false);
    };

    return (
        <ThemeProvider theme={theme}>
            <Fade in={true} timeout={1000}>
                <div className={classes.root}>
                    {isTextCheckerOpen ? (
                        <TextChecker onBack={handleCloseTextChecker} />
                    ) : (
                        <>
                            <img src="/static/dek.svg" alt="DEK Logo" className={classes.logo} />
                            
                            <Box className={classes.buttonContainer}>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    className={classes.button}
                                    onClick={handleOpenTextChecker}
                                >
                                    <TextFields className={classes.icon} />
                                    Kontrola textu
                                </Button>
                                <Button
                                    variant="contained"
                                    color="secondary"
                                    className={classes.button}
                                    onClick={handleCatalogOpen}
                                >
                                    <TableChart className={classes.icon} />
                                    Katalog
                                </Button>
                            </Box>

                            <Dialog open={catalogOpen} onClose={handleCatalogClose}>
                                <DialogTitle>Katalog</DialogTitle>
                                <DialogContent className={classes.dialogContent}>
                                    <TextField
                                        className={classes.searchField}
                                        fullWidth
                                        placeholder="Vyhledat tabulku"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <Search />
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                    <List>
                                        {filteredSheets.map((sheet) => (
                                            <ListItem button key={sheet.id} onClick={() => onSelectSheet(sheet.sheet_id)}>
                                                <ListItemText primary={sheet.name} secondary={sheet.url} />
                                            </ListItem>
                                        ))}
                                    </List>
                                    <Typography variant="h6">Přidat novou tabulku</Typography>
                                    <form onSubmit={handleAddSheet}>
                                        <TextField
                                            label="Název tabulky"
                                            value={newSheetName}
                                            onChange={(e) => setNewSheetName(e.target.value)}
                                            fullWidth
                                            margin="normal"
                                        />
                                        <TextField
                                            label="URL tabulky"
                                            value={newSheetUrl}
                                            onChange={(e) => setNewSheetUrl(e.target.value)}
                                            fullWidth
                                            margin="normal"
                                        />
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            color="primary"
                                            fullWidth
                                            startIcon={<Add />}
                                        >
                                            Přidat tabulku
                                        </Button>
                                    </form>
                                    <Box className={classes.dropZone}>
                                        <Typography>Nebo přetáhněte soubor sem</Typography>
                                    </Box>
                                </DialogContent>
                            </Dialog>
                        </>
                    )}
                </div>
            </Fade>
        </ThemeProvider>
    );
};

export default HomePage;