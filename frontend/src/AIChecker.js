import React, { useState, useEffect, useMemo, useContext, useCallback } from 'react';
import {
    Button, Select, MenuItem, FormControl, InputLabel,
    Grid, Container, Typography, AppBar, Toolbar, Tabs, Tab,
    Box, CircularProgress, TableContainer, Table, TableHead, IconButton, 
    TableBody, TableRow, TableCell, Checkbox, Paper, LinearProgress,
    Alert
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { SnackbarContext } from './SnackbarContext';
import AnalysisResult from './AnalysisResult';
import AnalysisInfo from './AnalysisInfo';
import ProgressBar from './ProgressBar';
import BacklogView from './BacklogView';
import FeedbackPopup from './FeedbackPopup';
import Countdown from './Countdown';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';

const Root = styled('div')(({ theme }) => ({
    flexGrow: 1,
}));

const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
    width: '100%',
    overflowX: 'auto',
}));

const StyledTable = styled(Table)(({ theme }) => ({
    minWidth: '100%',
}));

const TableHeadStyled = styled(TableHead)(({ theme }) => ({
    backgroundColor: theme.palette.grey[200],
}));

const TableCellStyled = styled(TableCell)(({ theme }) => ({
    whiteSpace: 'nowrap',
    padding: theme.spacing(1),
}));

const StatCard = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(2),
    textAlign: 'center',
}));

const LoadMoreButton = styled(Button)(({ theme }) => ({
    marginTop: theme.spacing(2),
}));

const AIChecker = ({ sheetId, onBack }) => {
    const [columns, setColumns] = useState([]);
    const [productNameColumn, setProductNameColumn] = useState('');
    const [analysisColumn, setAnalysisColumn] = useState('');
    const [analysisResults, setAnalysisResults] = useState([]);
    const [sheetData, setSheetData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [activeTab, setActiveTab] = useState('statistics');
    const [lastUpdated, setLastUpdated] = useState(null);
    const [warning, setWarning] = useState('');
    const [assistants, setAssistants] = useState([]);
    const [selectedAssistant, setSelectedAssistant] = useState('');
    const [sortOrder, setSortOrder] = useState('asc');
    const [filterValue, setFilterValue] = useState('');
    const [selectedColumns, setSelectedColumns] = useState(['Číslo položky', 'Popis', 'www']);
    const [checkedRows, setCheckedRows] = useState({});
    const [visibleResults, setVisibleResults] = useState({});
    const [backlogResponses, setBacklogResponses] = useState([]);
    const [aiMasterPrompt, setAiMasterPrompt] = useState('');
    const showSnackbar = useContext(SnackbarContext);
    const [lastResponses, setLastResponses] = useState([]);
    const [feedbackPopupOpen, setFeedbackPopupOpen] = useState(false);
    const [currentFeedbackResult, setCurrentFeedbackResult] = useState(null);
    const [visibleResultsCount, setVisibleResultsCount] = useState(10);
    const [totalExpectedResponses, setTotalExpectedResponses] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalResponses, setTotalResponses] = useState(0);

    useEffect(() => {
        fetchSheetData();
        fetchAssistants();
        const interval = setInterval(fetchSheetData, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const fetchSheetData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/get_sheet_data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sheet_id: sheetId }),
            });
            const data = await response.json();
            if (data.status === 'success') {
                setSheetData(data.data);
                setColumns(data.columns);
                setDataLoaded(true);
                setLastUpdated(data.last_updated);
                setWarning(data.warning);
                if (data.analysis_results && data.analysis_results.length > 0) {
                    setAnalysisResults(data.analysis_results);
                }
                showSnackbar('Data tabulky byla úspěšně načtena.', 'success');
            } else {
                throw new Error(data.message || 'Unknown error occurred');
            }
        } catch (error) {
            console.error("Error fetching sheet data:", error);
            setError(`Error fetching sheet data: ${error.message}`);
            showSnackbar('Nepodařilo se načíst data tabulky. Zkuste to prosím znovu.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [sheetId, showSnackbar]);

    const fetchAssistants = useCallback(async () => {
        try {
            const response = await fetch('/get_assistants');
            const data = await response.json();
            setAssistants(data);
            if (data.length > 0) {
                setSelectedAssistant(data[0][1]);
            }
        } catch (error) {
            console.error("Error fetching assistants:", error);
            setError(`Error fetching assistants: ${error.message}`);
        }
    }, []);

    const handleFeedbackClick = (result) => {
        setCurrentFeedbackResult(result);
        setFeedbackPopupOpen(true);
    };

    const handleFeedbackSubmit = async (feedbackText) => {
        try {
            const response = await fetch('/save_feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    result: currentFeedbackResult,
                    feedback: feedbackText,
                }),
            });

            if (!response.ok) {
                throw new Error('Nepodařilo se uložit feedback');
            }

            showSnackbar('Feedback byl úspěšně uložen', 'success');
        } catch (error) {
            console.error('Chyba při ukládání feedbacku:', error);
            showSnackbar('Nepodařilo se uložit feedback', 'error');
        }
    };

    const handleUpdateResult = useCallback((resultId, updatedVersion) => {
        setLastResponses(prevResponses =>
            prevResponses.map(response =>
                response.id === resultId
                    ? { ...response, versions: [...response.versions.slice(0, -1), updatedVersion] }
                    : response
            )
        );
    }, []);

    const fetchLastResponses = useCallback(async (page = 1) => {
        if (!productNameColumn || !analysisColumn || !selectedAssistant) {
            console.log("Missing required parameters for fetchLastResponses");
            return;
        }

        try {
            const url = `/get_last_responses?sheet_id=${sheetId}&product_name_column=${encodeURIComponent(productNameColumn)}&analysis_column=${encodeURIComponent(analysisColumn)}&assistant_id=${selectedAssistant}&page=${page}&per_page=10`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'success') {
                setLastResponses(data.responses);
                setCurrentPage(data.page);
                setTotalPages(data.total_pages);
                setTotalResponses(data.total);
            } else {
                throw new Error(data.message || 'Nepodařilo se načíst poslední odpovědi');
            }
        } catch (error) {
            console.error("Error fetching last responses:", error);
            showSnackbar('Nepodařilo se načíst poslední odpovědi. Zkuste to prosím znovu.', 'error');
        }
    }, [sheetId, productNameColumn, analysisColumn, selectedAssistant, showSnackbar]);

    useEffect(() => {
        if (productNameColumn && analysisColumn && selectedAssistant) {
            fetchLastResponses(1);
        }
    }, [productNameColumn, analysisColumn, selectedAssistant, fetchLastResponses]);

    useEffect(() => {
        if (columns.length > 0) {
            const descriptionColumn = columns.find(column => column === 'Název');
            if (descriptionColumn) {
                setProductNameColumn(descriptionColumn);
            } else {
                console.warn("Could not find 'Název' column");
            }
            const defaultColumns = ['Číslo položky', 'Popis', 'www'].filter(col => columns.includes(col));
            setSelectedColumns(defaultColumns);
        }
    }, [columns]);

    const renderLastResponses = useCallback(() => {
        if (!lastResponses || lastResponses.length === 0) {
            return (
                <Typography variant="body1" sx={{ mt: 2 }}>
                    Žádná data k dispozici
                </Typography>
            );
        }

        const visibleResponses = lastResponses.slice(0, visibleResultsCount);

        return (
            <Box mt={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">
                        GPT kontrola
                    </Typography>
                    {isLoading && (
                        <Box display="flex" alignItems="center">
                            <Typography variant="body2" color="text.secondary" mr={2}>
                                Probíhá analýza...
                            </Typography>
                            <CircularProgress size={24} />
                        </Box>
                    )}
                </Box>

                {isLoading && totalExpectedResponses > 0 && (
                    <ProgressBar progress={(lastResponses.length / totalExpectedResponses) * 100} />
                )}

                {visibleResponses.map((response, index) => {
                    if (!response) {
                        console.error("Invalid response:", response);
                        return null;
                    }

                    const rowData = sheetData.find(row =>
                        row[productNameColumn]?.toLowerCase().trim() === response.product_name.original?.toLowerCase().trim()
                    );

                    const itemNumber = rowData ? rowData["Číslo položky"] : "N/A";

                    return (
                        <AnalysisResult
                            key={response.id || index}
                            result={{
                                ...response,
                                row_index: index,
                                itemNumber: itemNumber,
                                product_name: response.product_name || { original: 'Neznámý produkt' },
                                product_description: response.product_description || {
                                    original: '',
                                    improved: '',
                                    changes: []
                                },
                                versions: response.versions || []
                            }}
                            onConfirm={handleConfirm}
                            onReject={handleReject}
                            onFeedback={handleFeedbackClick}
                            onUpdate={handleUpdateResult}
                        />
                    );
                })}
                {lastResponses.length > visibleResultsCount && (
                    <LoadMoreButton
                        onClick={() => setVisibleResultsCount(prev => prev + 10)}
                        variant="outlined"
                    >
                        Načíst další
                    </LoadMoreButton>
                )}
            </Box>
        );
    }, [lastResponses, visibleResultsCount, sheetData, productNameColumn, handleConfirm, handleReject, handleFeedbackClick, isLoading, totalExpectedResponses, handleUpdateResult]);

    const fetchBacklogResponses = useCallback(async () => {
        try {
            const response = await fetch('/get_gpt_responses');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.status === 'success') {
                setBacklogResponses(data.responses);
                showSnackbar(`Načteno ${data.responses.length} odpovědí z backlogu`, 'success');
            } else {
                throw new Error(data.message || 'Nepodařilo se načíst backlog odpovědi');
            }
        } catch (error) {
            console.error("Error fetching backlog responses:", error);
            showSnackbar('Nepodařilo se načíst backlog odpovědi. Zkuste to prosím znovu.', 'error');
        }
    }, [showSnackbar]);

    useEffect(() => {
        if (activeTab === 'backlog') {
            fetchBacklogResponses();
        }
    }, [activeTab, fetchBacklogResponses]);

    const saveGptResponse = async (result) => {
        try {
            const response = await fetch('/save_gpt_response', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sheet_id: sheetId,
                    product_name: result.product_name.original || result.product_name,
                    product_name_column: productNameColumn,
                    analysis_column: analysisColumn,
                    assistant_id: selectedAssistant,
                    original_text: result.product_description.original,
                    improved_text: result.product_description.improved,
                    changes: result.versions[0].changes
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const data = await response.json();
            if (data.status === 'success') {
                showSnackbar('GPT odpověď byla úspěšně uložena do backlogu', 'success');
            }
        } catch (error) {
            console.error('Error saving GPT response:', error);
            showSnackbar('Chyba při ukládání GPT odpovědi: ' + error.message, 'error');
        }
    };

    const handleAnalyze = useCallback(() => {
        setIsLoading(true);
        setError(null);
        setLastResponses([]);

        const rowsToAnalyze = sheetData.filter(row => row[productNameColumn] && row[analysisColumn]).length;
        setTotalExpectedResponses(rowsToAnalyze);

        const eventSource = new EventSource(`/analyze?sheet_id=${sheetId}&product_name_column=${encodeURIComponent(productNameColumn)}&analysis_column=${encodeURIComponent(analysisColumn)}&assistant_id=${selectedAssistant}`);

        eventSource.onmessage = async (event) => {
            try {
                const result = JSON.parse(event.data);
                if (result.status === 'error') {
                    console.error("Error in analysis result:", result.message);
                    setError(result.message);
                    showSnackbar(result.message, 'error');
                } else {
                    const formattedResult = {
                        id: result.id,
                        product_name: typeof result.product_name === 'object' ? result.product_name.original : result.product_name,
                        product_description: {
                            original: result.product_description?.original || '',
                            improved: result.product_description?.improved || ''
                        },
                        versions: [{
                            version_number: 1,
                            improved_text: result.product_description?.improved || '',
                            changes: result.product_description?.changes || [],
                            prompt: result.prompt || 'Grammar'
                        }]
                    };
                    setLastResponses(prevResponses => [...prevResponses, formattedResult]);
                    await saveGptResponse(formattedResult);
                }
            } catch (error) {
                console.error("Error processing result:", error);
                setError("Chyba při zpracování výsledku analýzy: " + error.message);
                showSnackbar('Došlo k chybě při zpracování výsledků analýzy.', 'error');
            }
        };

        eventSource.addEventListener('done', (event) => {
            setIsLoading(false);
            showSnackbar('Analýza byla úspěšně dokončena!', 'success');
            eventSource.close();
        });

        return () => {
            eventSource.close();
        };
    }, [sheetId, productNameColumn, analysisColumn, selectedAssistant, saveGptResponse, showSnackbar, sheetData]);

    const handleReject = async (result) => {
        try {
            const response = await fetch('/update_gpt_response_status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    response_id: result.id,
                    status: 'rejected'
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Nepodařilo se aktualizovat stav odpovědi');
            }

            setLastResponses(prev => prev.filter(response => response.id !== result.id));
            setVisibleResults(prev => ({ ...prev, [result.row_index]: false }));
            showSnackbar('Návrh byl úspěšně zamítnut', 'success');
        } catch (error) {
            console.error('Chyba při zamítnutí návrhu:', error);
            showSnackbar(`Chyba při zamítnutí návrhu: ${error.message}`, 'error');
        }
    };

    const handleConfirm = async (result, selectedVersion) => {
        try {
            if (!analysisColumn) {
                throw new Error('Sloupec k analýze není vybrán');
            }

            if (!selectedVersion || typeof selectedVersion !== 'object') {
                console.error("Neplatná selectedVersion:", selectedVersion);
                throw new Error('Neplatná verze vybrána');
            }

            const improvedText = selectedVersion.improved_text || result.product_description?.improved || '';
            const cleanedText = cleanText(improvedText);

            const response = await fetch('/update_sheet_data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sheet_id: sheetId,
                    row_index: result.row_index,
                    column_name: analysisColumn,
                    new_value: cleanedText
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Nepodařilo se aktualizovat data');
            }

            await fetch('/update_gpt_response_status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    response_id: result.id,
                    status: 'confirmed'
                }),
            });

            setSheetData(prevData => {
                const newData = [...prevData];
                const rowToUpdate = newData[result.row_index];
                if (rowToUpdate) {
                    rowToUpdate[analysisColumn] = cleanedText;
                }
                return newData;
            });

            setLastResponses(prev => prev.filter(response => response.id !== result.id));
            setVisibleResults(prev => ({ ...prev, [result.row_index]: false }));

            await fetchBacklogResponses();

            showSnackbar('Data byla úspěšně aktualizována', 'success');
        } catch (error) {
            console.error('Chyba při aktualizaci dat:', error);
            showSnackbar(`Chyba při aktualizaci dat: ${error.message}`, 'error');
        }
    };

    const renderStatistics = () => {
        if (!sheetData.length) return <Typography>Žádná data k zobrazení</Typography>;

        const rowCount = sheetData.length;
        const columnCount = columns.length;
        const nonEmptyCells = sheetData.reduce((acc, row) =>
            acc + Object.values(row).filter(cell => cell !== "").length, 0);
        const emptyCells = rowCount * columnCount - nonEmptyCells;
        const totalCells = rowCount * columnCount;
        const completionPercentage = (nonEmptyCells / totalCells) * 100;

        return (
            <Box p={3}>
                <Grid container spacing={3}>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard>
                            <Typography variant="h6">Počet řádků</Typography>
                            <Typography variant="h4">{rowCount}</Typography>
                        </StatCard>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard>
                            <Typography variant="h6">Počet sloupců</Typography>
                            <Typography variant="h4">{columnCount}</Typography>
                        </StatCard>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard>
                            <Typography variant="h6">Neprázdné buňky</Typography>
                            <Typography variant="h4">{nonEmptyCells}</Typography>
                        </StatCard>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard>
                            <Typography variant="h6">Prázdné buňky</Typography>
                            <Typography variant="h4">{emptyCells}</Typography>
                        </StatCard>
                    </Grid>
                </Grid>

                <Box mt={4}>
                    <Typography variant="h6" gutterBottom>Kompletnost dat</Typography>
                    <LinearProgress variant="determinate" value={completionPercentage} />
                    <Typography variant="body2" color="textSecondary" align="right">
                        {completionPercentage.toFixed(2)}% kompletní
                    </Typography>
                </Box>

                <Grid container spacing={3} mt={4}>
                    <Grid item xs={12} md={6}>
                        <StatCard>
                            <Typography variant="h6">Countdown</Typography>
                            <Countdown />
                        </StatCard>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <StatCard>
                            <Typography variant="h6">Poslední aktualizace</Typography>
                            <Typography variant="h4">
                                {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'N/A'}
                            </Typography>
                        </StatCard>
                    </Grid>
                </Grid>

                {warning && (
                    <Box mt={4}>
                        <Alert severity="warning">
                            <Typography variant="h6">Varování</Typography>
                            <Typography>{warning}</Typography>
                        </Alert>
                    </Box>
                )}
            </Box>
        );
    };

    const renderTable = () => {
        if (!sheetData.length) return <Typography>Žádná data k zobrazení</Typography>;

        return (
            <StyledTableContainer component={Paper}>
                <StyledTable size="small" stickyHeader>
                    <TableHeadStyled>
                        <TableRow>
                            <TableCellStyled padding="checkbox">
                                <Checkbox
                                    indeterminate={Object.values(checkedRows).some(Boolean) && !Object.values(checkedRows).every(Boolean)}
                                    checked={Object.values(checkedRows).every(Boolean)}
                                    onChange={() => {
                                        const newCheckedRows = {};
                                        const allChecked = Object.values(checkedRows).every(Boolean);
                                        sheetData.forEach((_, index) => {
                                            newCheckedRows[index] = !allChecked;
                                        });
                                        setCheckedRows(newCheckedRows);
                                    }}
                                />
                            </TableCellStyled>
                            {columns.map((column, index) => (
                                <TableCellStyled key={index}>{column}</TableCellStyled>
                            ))}
                        </TableRow>
                    </TableHeadStyled>
                    <TableBody>
                        {sheetData.map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                                <TableCellStyled padding="checkbox">
                                    <Checkbox
                                        checked={!!checkedRows[rowIndex]}
                                        onChange={() => handleCheckboxChange(rowIndex)}
                                    />
                                </TableCellStyled>
                                {columns.map((column, colIndex) => (
                                    <TableCellStyled key={colIndex}>{row[column]}</TableCellStyled>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </StyledTable>
            </StyledTableContainer>
        );
    };

    const handleSaveProduct = async (editedProduct) => {
        // TODO: Implement saving changes to the backend
        console.log("Saving edited product:", editedProduct);
    };

    const sortedAndFilteredData = useMemo(() => {
        return sheetData
            .filter(product =>
                product["Číslo položky"].toString().includes(filterValue) ||
                product["Název"].toLowerCase().includes(filterValue.toLowerCase())
            )
            .sort((a, b) => {
                if (sortOrder === 'asc') {
                    return a["Číslo položky"].localeCompare(b["Číslo položky"]);
                } else {
                    return b["Číslo položky"].localeCompare(a["Číslo položky"]);
                }
            });
    }, [sheetData, sortOrder, filterValue]);


    const handleCheckboxChange = (rowIndex) => {
        setCheckedRows(prev => ({
            ...prev,
            [rowIndex]: !prev[rowIndex]
        }));
    };

    return (
        <Root>
            <AppBar position="static">
                <Toolbar>
                    <IconButton
                        edge="start"
                        color="inherit"
                        onClick={onBack}
                        aria-label="back"
                        sx={{ mr: 2 }}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        DEK AI
                    </Typography>
                    <Tabs
                        value={activeTab}
                        onChange={(e, newValue) => setActiveTab(newValue)}
                    >
                        <Tab label="Dashboard" value="statistics" />
                        <Tab label="Data" value="table" />
                        <Tab label="AI Asistenti" value="analysis" />
                        <Tab label="Backlog" value="backlog" />
                    </Tabs>
                </Toolbar>
            </AppBar>
            <Box sx={{ p: 3 }}>
                {error && (
                    <Typography color="error" gutterBottom>
                        {error}
                    </Typography>
                )}

                {activeTab === 'statistics' && (
                    <Container maxWidth="lg">
                        {renderStatistics()}
                    </Container>
                )}
                {activeTab === 'table' && (
                    <Container maxWidth={false}>
                        {renderTable()}
                    </Container>
                )}
                {activeTab === 'analysis' && (
                    <Container maxWidth="lg">
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={3}>
                                <FormControl fullWidth>
                                    <InputLabel>Sloupec s názvem produktu</InputLabel>
                                    <Select
                                        value={productNameColumn}
                                        onChange={(e) => setProductNameColumn(e.target.value)}
                                    >
                                        {columns.sort((a, b) => a.localeCompare(b, 'cs')).map((column) => (
                                            <MenuItem key={column} value={column}>{column}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <FormControl fullWidth>
                                    <InputLabel>Sloupec k analýze</InputLabel>
                                    <Select
                                        value={analysisColumn}
                                        onChange={(e) => setAnalysisColumn(e.target.value)}
                                    >
                                        {columns.sort((a, b) => a.localeCompare(b, 'cs')).map((column) => (
                                            <MenuItem key={column} value={column}>{column}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <FormControl fullWidth>
                                    <InputLabel>Asistent</InputLabel>
                                    <Select
                                        value={selectedAssistant}
                                        onChange={(e) => setSelectedAssistant(e.target.value)}
                                    >
                                        {assistants.sort((a, b) => a[0].localeCompare(b[0], 'cs')).map(([name, id]) => (
                                            <MenuItem key={id} value={id}>{name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={handleAnalyze}
                                    disabled={!productNameColumn || !analysisColumn || !selectedAssistant || isLoading}
                                    fullWidth
                                >
                                    {isLoading ? 'Spouštím analýzu...' : 'Odeslat data'}
                                </Button>
                            </Grid>
                        </Grid>

                        {(!productNameColumn || !analysisColumn || !selectedAssistant) ? (
                            <AnalysisInfo />
                        ) : (
                            <>
                                {renderLastResponses()}

                                {dataLoaded && !analysisResults.length && (
                                    <Typography variant="body1" sx={{ mt: 2 }}>
                                        Tabulka načtena
                                    </Typography>
                                )}

                                {analysisResults.length > 0 && (
                                    <Box>
                                        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                            Výsledky analýzy
                                        </Typography>
                                        {analysisResults.map((result, index) => (
                                            visibleResults[result.row_index] !== false && (
                                                <AnalysisResult
                                                    key={result.row_index || index}
                                                    result={result}
                                                    onConfirm={handleConfirm}
                                                    onReject={handleReject}
                                                    onFeedback={handleFeedbackClick}
                                                />
                                            )
                                        ))}
                                    </Box>
                                )}
                            </>
                        )}
                    </Container>
                )}
                {activeTab === 'backlog' && (
                    <Container maxWidth="lg">
                        <BacklogView responses={backlogResponses} />
                    </Container>
                )}
            </Box>
            <FeedbackPopup
                open={feedbackPopupOpen}
                onClose={() => setFeedbackPopupOpen(false)}
                onSubmit={handleFeedbackSubmit}
            />
        </Root>
    );
};

export default AIChecker;