"""
Contains a class that can be used as a logger for spinedb_api functions if needed.
"""

import sys
from html.parser import HTMLParser
from PySide6.QtCore import QObject, Signal, Slot


class HeadlessLogger(QObject):
    """A :class:`LoggerInterface` compliant logger that uses Python's standard logging facilities."""

    msg = Signal(str)
    """Emits a notification message."""
    msg_success = Signal(str)
    """Emits a message on success"""
    msg_warning = Signal(str)
    """Emits a warning message."""
    msg_error = Signal(str)
    """Emits an error message."""
    msg_proc = Signal(str)
    """Emits a message originating from a subprocess (usually something printed to stdout)."""
    msg_proc_error = Signal(str)
    """Emits an error message originating from a subprocess (usually something printed to stderr)."""
    information_box = Signal(str, str)
    """Requests an 'information message box' (e.g. a message window) to be opened with a given title and message."""
    error_box = Signal(str, str)
    """Requests an 'error message box' to be opened with a given title and message."""

    def __init__(self):
        super().__init__()
        self.msg.connect(self._log_message)
        self.msg_success.connect(self._log_message)
        self.msg_warning.connect(self._log_warning)
        self.msg_error.connect(self._log_error)
        self.msg_proc.connect(self._log_message)
        self.msg_proc_error.connect(self._log_error)
        self.information_box.connect(self._show_information_box)
        self.error_box.connect(self._show_error_box)
        self._tag_filter = HTMLTagFilter()

    @Slot(str)
    def _log_message(self, message):
        """Prints an information message."""
        self._print(message, sys.stdout)

    @Slot(str)
    def _log_warning(self, message):
        """Prints a warning message."""
        self._print(message, sys.stdout)

    @Slot(str)
    def _log_error(self, message):
        """Prints an error message."""
        self._print(message, sys.stderr)

    @Slot(str, str)
    def _show_information_box(self, title, message):
        """Prints an information message with a title."""
        self._print(title + ": " + message, sys.stdout)

    @Slot(str, str)
    def _show_error_box(self, title, message):
        """Prints an error message with a title."""
        self._print(title + ": " + message, sys.stderr)

    def _print(self, message, out_stream):
        """Filters HTML tags from message before printing it to given file."""
        self._tag_filter.feed(message)
        print(self._tag_filter.drain(), file=out_stream)


class HTMLTagFilter(HTMLParser):
    """HTML tag filter."""

    def __init__(self):
        super().__init__()
        self._text = ""

    def drain(self):
        text = self._text
        self._text = ""
        return text

    def handle_data(self, data):
        self._text += data

    def handle_starttag(self, tag, attrs):
        if tag == "br":
            self._text += "\n"

    def error(self, message):
        """To stop pylint whining"""

