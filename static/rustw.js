// Copyright 2016-2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

module.exports = {
    do_build: function() {
        if (CONFIG.demo_mode) {
            do_build_internal('test');
        } else {
            do_build_internal('build');
        }
    },

    onLoad: function () {
        $.getJSON("/config", function(data) {
            CONFIG = data;
            if (CONFIG.build_on_load) {
                module.exports.do_build();
            }
        });

        load_start();
        MAIN_PAGE_STATE = { page: "start" };
        history.replaceState(MAIN_PAGE_STATE, "");

        window.onpopstate = function(event) {
            var state = event.state;
            if (!state) {
                console.log("ERROR: null state: ");
                load_start();
            } else if (state.page == "start") {
                load_start();
            } else if (state.page == "error") {
                load_error();
            } else if (state.page == "build") {
                pre_load_build();
                load_build(state);
            } else if (state.page == "err_code") {
                load_err_code(state);
            } else if (state.page == "source") {
                load_source(state);
            } else if (state.page == "source_dir") {
                load_dir(state);
            } else if (state.page == "search") {
                module.exports.load_search(state);
            } else if (state.page == "find") {
                load_find(state);
            } else if (state.page == "summary") {
                load_summary(state);
            } else {
                console.log("ERROR: Unknown page state: ");
                console.log(state);
                load_start();
            }
        };    
    },

    win_src_link: function () {
        topbar.renderTopBar("builtAndNavigating");
        module.exports.load_link.call(this);
    },

    show_src_link_menu: function (event) {
        var src_menu = $("#div_src_menu");
        var data = show_menu(src_menu, event, hide_src_link_menu);

        if (CONFIG.unstable_features) {
            var edit_data = { 'link': data.target.attr("data-link"), 'hide_fn': hide_src_link_menu };
            $("#src_menu_edit").click(edit_data, edit);
            $("#src_menu_quick_edit").click(data, quick_edit_link);
        } else {
            $("#src_menu_edit").hide();
            $("#src_menu_quick_edit").hide();        
        }
        $("#src_menu_view").click(data.target, view_from_menu);

        return false;
    },

    win_err_code: function (domElement, errData) {
        let element = $(domElement);
        var explain = element.attr("data-explain");
        if (!explain) {
            return;
        }

        topbar.renderTopBar("builtAndNavigating");

        // Prepare the data for the error code window.
        var data = { "code": element.attr("data-code"), "explain": marked(explain), "error": errData };

        var state = { page: "err_code", data: data };
        load_err_code(state);
        history.pushState(state, "", utils.make_url("#" + element.attr("data-code")));
    },

    pre_load_build: function() {
        SNIPPET_PLAIN_TEXT = {};
        window.scroll(0, 0);
    },

    load_build: function (state) {
        topbar.renderTopBar("built");

        // TODO use React for page re-loads
        // update_snippets(MAIN_PAGE_STATE.snippets);
    },

    load_error: function () {
        $("#div_main").text("Server error?");
    },

    // Identifer search - shows defs and refs
    load_search: function (state) {
        load_search_internal(state);
    },

    highlight_spans(highlight, line_number_prefix, src_line_prefix, css_class) {
        if (!highlight.line_start || !highlight.line_end) {
            return;
        }

        if (line_number_prefix) {
            for (var i = highlight.line_start; i <= highlight.line_end; ++i) {
                $("#" + line_number_prefix + i).addClass(css_class);
            }
        }

        if (!highlight.column_start || !highlight.column_end || !src_line_prefix) {
            return;
        }

        // Highlight all of the middle lines.
        for (var i = highlight.line_start + 1; i <= highlight.line_end - 1; ++i) {
            $("#" + src_line_prefix + i).addClass(css_class);
        }

        // If we don't have columns (at least a start), then highlight all the lines.
        // If we do, then highlight between columns.
        if (highlight.column_start <= 0) {
            $("#" + src_line_prefix + highlight.line_start).addClass(css_class);
            $("#" + src_line_prefix + highlight.line_end).addClass(css_class);

            // TODO hover text
        } else {
            // First line
            var lhs = (highlight.column_start - 1);
            var rhs = 0;
            if (highlight.line_end == highlight.line_start && highlight.column_end > 0) {
                // If we're only highlighting one line, then the highlight must stop
                // before the end of the line.
                rhs = (highlight.column_end - 1);
            }
            make_highlight(src_line_prefix, highlight.line_start, lhs, rhs, css_class);

            // Last line
            if (highlight.line_end > highlight.line_start) {
                var rhs = 0;
                if (highlight.column_end > 0) {
                    rhs = (highlight.column_end - 1);
                }
                make_highlight(src_line_prefix, highlight.line_end, 0, rhs, css_class);
            }
        }
    },

    get_source: function(file_name) {
        get_source_internal(file_name);
    },

    load_link: function() {
        var file_loc = this.dataset.link.split(':');
        var file = file_loc[0];

        if (file == "search") {
            find_uses(file_loc[1]);
            return;
        }

        if (file == "summary") {
            summary(file_loc[1]);
            return;
        }

        var line_start = parseInt(file_loc[1], 10);
        var column_start = parseInt(file_loc[2], 10);
        var line_end = parseInt(file_loc[3], 10);
        var column_end = parseInt(file_loc[4], 10);

        if (line_start == 0 || isNaN(line_start)) {
            line_start = 0;
            line_end = 0;
        } else if (line_end == 0 || isNaN(line_end)) {
            line_end = line_start;
        }

        if (isNaN(column_start) || isNaN(column_end)) {
            column_start = 0;
            column_end = 0;
        }

        // FIXME the displayed span doesn't include column start and end, should it?
        var display = "";
        if (line_start > 0) {
            display += ":" + line_start;
            if (!(line_end == 0 || line_end == line_start)) {
                display += ":" + line_end;
            }
        }

        var data = {
            "file": file,
            "display": display,
            "line_start": line_start,
            "line_end": line_end,
            "column_start": column_start,
            "column_end": column_end
        };
        load_source_view(data);
    }
};

const errors = require("./errors");
const err_code = require('./err_code');
const topbar = require('./topbar');
const dirView = require('./dirView');
const search = require('./search');
const srcView = require('./srcView');
const utils = require('./utils');

Handlebars.registerHelper("inc", function(value, options)
{
    return parseInt(value) + 1;
});

Handlebars.registerHelper("add", function(a, b, options)
{
    return parseInt(a) + parseInt(b);
});

Handlebars.registerHelper("def", function(a, b, options)
{
    return a != undefined;
});

function load_start() {
    $("#div_main").html("");
    // TODO at this point, it makes sense to make these programatically.
    $("#div_src_menu").hide();
    $("#div_line_number_menu").hide();
    $("#div_ref_menu").hide();
    $("#div_glob_menu").hide();
    $("#div_quick_edit").hide();
    $("#div_rename").hide();
    $("#measure").hide();

    topbar.renderTopBar("fresh");
}

function load_summary(state) {
    topbar.renderTopBar("builtAndNavigating");
    // console.log(state.data);
    $("#div_main").html(Handlebars.templates.summary(state.data));

    // Make link and menus for idents on the page.
    let idents = $(".summary_ident");
    idents.click(module.exports.load_link);
    idents.on("contextmenu", (ev) => {
        let target = ev.target;
        ev.data = ev.target.id.substring("def_".length);
        return show_ref_menu(ev);
    });

    // Add links and menus for breadcrumbs.
    let breadcrumbs = $(".link_breadcrumb");
    breadcrumbs.click(module.exports.load_link);
    breadcrumbs.on("contextmenu", (ev) => {
        let target = ev.target;
        ev.data = ev.target.id.substring("breadcrumb_".length);
        return show_ref_menu(ev);
    });

    // Hide extra docs.
    hide_summary_doc();

    // Up link to jump up a level.
    $("#jump_up").click(module.exports.load_link);
    // Down links to jump to children.
    $(".jump_children").click(module.exports.load_link);

    window.scroll(0, 0);
}

function show_hide(element, text, fn) {
    element.text(text);
    element.off("click");
    element.click(fn);
}

function show_summary_doc() {
    var element = $("#expand_docs");
    show_hide(element, "-", hide_summary_doc);
    $("#div_summary_doc_more").show();
}

function hide_summary_doc() {
    var element = $("#expand_docs");
    show_hide(element, "+", show_summary_doc);
    $("#div_summary_doc_more").hide();
}

function load_search_internal(state) {
    topbar.renderTopBar("builtAndNavigating");
    search.renderSearchResults(state.data.defs, state.data.refs, $("#div_main").get(0));
    window.scroll(0, 0);
}

// Find = basic search, just a list of uses, e.g., find impls or text search
function load_find(state) {
    topbar.renderTopBar("builtAndNavigating");
    search.renderFindResults(state.data.results, $("#div_main").get(0));
    window.scroll(0, 0);
}

function load_err_code(state) {
    err_code.renderErrorExplain(state.data, $("#div_main").get(0));
}

function load_source(state) {
    const highlight = {
        file: state.file,
        display: state.display,
        line_start: state.line_start,
        line_end: state.line_end,
        column_start: state.column_start,
        column_end: state.column_end
    };
    srcView.renderSourceView(state.data.path, state.data.lines, highlight, $("#div_main").get(0));

    // Jump to the start line. 100 is a fudge so that the start line is not
    // right at the top of the window, which makes it easier to see.
    var y = state.line_start * $("#src_line_number_1").height() - 100;
    window.scroll(0, y);
}

// Left is the number of chars from the left margin to where the highlight
// should start. right is the number of chars to where the highlight should end.
// If right == 0, we take it as the last char in the line.
// 1234 |  text highlight text
//         ^    ^-------^
//         |origin
//         |----| left
//         |------------| right
function make_highlight(src_line_prefix, line_number, left, right, css_class) {
    var line_div = $("#" + src_line_prefix + line_number);
    var highlight = $("<div>&nbsp;</div>");
    highlight.addClass(css_class + " floating_highlight");

    left *= CHAR_WIDTH;
    right *= CHAR_WIDTH;
    if (right == 0) {
        right = line_div.width();
    }

    var width = right - left;
    var padding = parseInt(line_div.css("padding-left"));
    if (left > 0) {
        left += padding;
    } else {
        width += padding;
    }

    var offset = line_div.offset();
    line_div.after(highlight);
    offset.left += left;
    highlight.offset(offset);
    highlight.width(width);
}

function do_build_internal(buildStr) {
    errors.rebuildAndRender(buildStr, $("#div_main").get(0));
    topbar.renderTopBar("building");
    window.scroll(0, 0);
}

function get_source_internal(file_name) {
    topbar.renderTopBar("builtAndNavigating");

    $.ajax({
        url: 'src' + utils.make_url(file_name),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        if (json.Directory) {
            var state = {
                "page": "source_dir",
                "data": json.Directory,
                "file": file_name,
            };
            load_dir(state);
            history.pushState(state, "", utils.make_url("#src=" + file_name));
        } else if (json.Source) {
            var state = {
                "page": "source",
                "data": json.Source,
                "file": file_name,
            };
            load_source(state);
            history.pushState(state, "", utils.make_url("#src=" + file_name));
        } else {
            console.log("Unexpected source data.")
            console.log(json);
        }
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with source request for " + file_name);
        console.log("error: " + errorThrown + "; status: " + status);

        load_error();
        history.pushState({}, "", utils.make_url("#src=" + file_name));
    });

    $("#div_main").text("Loading...");
}

function load_dir(state) {
    dirView.renderDirView(state.file, state.data.files, state.data.path, $("#div_main").get(0));
    window.scroll(0, 0);
}

function load_source_view(data) {
    $.ajax({
        url: utils.make_url('src/' + data.file),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        data.page = "source";
        data.data = json.Source;
        load_source(data);

        history.pushState(data, "", utils.make_url("#src=" + data.file + data.display));
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with source request");
        console.log("error: " + errorThrown + "; status: " + status);

        load_error();
        history.pushState({ page: "error"}, "", utils.make_url("#src=" + data.file + data.display));
    });

    $("#div_main").text("Loading...");
}

function show_menu(menu, event, hide_fn) {
    var target = $(event.target);
    var data = {
        "position": { "top": event.pageY, "left": event.pageX },
        "target": target
    };

    menu.show();
    menu.offset(data.position);

    // TODO can we do better than this to close the menu? (Also options menu).
    $("#div_main").click(hide_fn);
    $("#div_header").click(hide_fn);

    return data;
}

function show_ref_menu(event) {
    var menu = $("#div_ref_menu");
    var data = show_menu(menu, event, hide_ref_menu);
    data.id = event.data;

    var doc_url = data.target.attr("doc_url");
    if (doc_url) {
        var view_data = { 'link': doc_url, 'hide_fn': hide_ref_menu };
        $("#ref_menu_view_docs").show();
        $("#ref_menu_view_docs").click(view_data, open_tab);
    } else {
        $("#ref_menu_view_docs").hide();
    }

    var src_url = data.target.attr("src_url");
    if (src_url) {
        var view_data = { 'link': src_url, 'hide_fn': hide_ref_menu };
        $("#ref_menu_view_source").show();
        $("#ref_menu_view_source").click(view_data, open_tab);
    } else {
        $("#ref_menu_view_source").hide();
    }

    $("#ref_menu_view_summary").click(event.data, (ev) => summary(ev.data));
    $("#ref_menu_find_uses").click(event.data, (ev) => find_uses(ev.data));

    let impls = data.target.attr("impls");
    // FIXME we could display the impl count in the menu
    if (impls && impls != "0") {
        $("#ref_menu_find_impls").click(event.data, (ev) => find_impls(ev.data));
    } else {
        $("#ref_menu_find_impls").hide();
    }

    if (CONFIG.unstable_features) {
        $("#ref_menu_rename").click(data, show_rename);
    } else {
        $("#ref_menu_rename").hide();
    }

    return false;
}

function hide_ref_menu() {
    hide_menu($("#div_ref_menu"));
}

function hide_src_link_menu() {
    hide_menu($("#div_src_menu"));
}

function hide_menu(menu) {
    menu.children("div").off("click");
    menu.hide();
}

function open_tab(event) {
    window.open(event.data.link, '_blank');
    event.data.hide_fn();
}

function summary(id) {
    $.ajax({
        url: utils.make_url('summary?id=' + id),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        var state = {
            "page": "summary",
            "data": json,
            "id": id,
        };
        load_summary(state);
        history.pushState(state, "", utils.make_url("#summary=" + id));
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with summary request for " + id);
        console.log("error: " + errorThrown + "; status: " + status);

        load_error();
        history.pushState({}, "", utils.make_url("#summary=" + id));
    });

    hide_ref_menu();
    $("#div_main").text("Loading...");
}

function find_uses(needle) {
    $.ajax({
        url: utils.make_url('search?id=' + needle),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        var state = {
            "page": "search",
            "data": json,
            "id": needle,
        };
        load_search(state);
        history.pushState(state, "", utils.make_url("#search=" + needle));
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with search request for " + needle);
        console.log("error: " + errorThrown + "; status: " + status);

        load_error();
        history.pushState({}, "", utils.make_url("#search=" + needle));
    });

    hide_ref_menu();
    $("#div_main").text("Loading...");
}

function find_impls(needle) {
    $.ajax({
        url: utils.make_url('find?impls=' + needle),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        var state = {
            "page": "find",
            "data": json,
            "kind": "impls",
            "id": needle,
        };
        load_find(state);
        history.pushState(state, "", utils.make_url("#impls=" + needle));
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with find (impls) request for " + needle);
        console.log("error: " + errorThrown + "; status: " + status);

        load_error();
        history.pushState({}, "", utils.make_url("#impls=" + needle));
    });

    hide_ref_menu();
    $("#div_main").text("Loading...");
}

function show_rename(event) {
    hide_ref_menu();

    var div_rename = $("#div_rename");

    div_rename.show();
    div_rename.offset(event.data.position);

    $("#rename_text").prop("disabled", false);

    $("#rename_message").hide();
    $("#rename_cancel").text("cancel");
    $("#rename_cancel").click(hide_rename);
    $("#div_main").click(hide_rename);
    $("#div_header").click(hide_rename);
    $("#rename_save").show();
    $("#rename_save").click(event.data, save_rename);
    $(document).on("keypress", "#rename_text", function(e) {
         if (e.which == 13) {
             save_rename({ data: event.data });
         }
    });

    $("#rename_text").val(event.data.target[0].textContent);
    $("#rename_text").select();
}

function hide_rename() {
    $("#rename_save").off("click");
    $("#rename_cancel").off("click");
    $("#div_rename").hide();
}

// Note event is not necessarily an actual event, might be faked.
function save_rename(event) {
    $("#rename_message").show();
    $("#rename_message").text("saving...");
    $("#rename_save").hide();
    $("#rename_cancel").text("close");
    $("#rename_text").prop("disabled", true);

    $.ajax({
        url: utils.make_url('rename?id=' + event.data.id + "&text=" + $("#rename_text").val()),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        console.log("rename - success");
        $("#rename_message").text("rename saved");

        reload_source();

        // TODO add a fade-out animation here
        window.setTimeout(hide_rename, 1000);
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with rename request");
        console.log("error: " + errorThrown + "; status: " + status);
        $("#rename_message").text("error trying to save rename");
    });
}

function edit(event) {
    $.ajax({
        url: utils.make_url('edit?file=' + event.data.link),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        console.log("edit - success");
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with edit request");
        console.log("error: " + errorThrown + "; status: " + status);
    });

    event.data.hide_fn();
}

function show_quick_edit(event) {
    var quick_edit_div = $("#div_quick_edit");

    quick_edit_div.show();
    quick_edit_div.offset(event.data.position);

    $("#quick_edit_text").prop("disabled", false);

    $("#quick_edit_message").hide();
    $("#quick_edit_cancel").text("cancel");
    $("#quick_edit_cancel").click(hide_quick_edit);
    $("#div_main").click(hide_quick_edit);
    $("#div_header").click(hide_quick_edit);
}

// Quick edit for a source link in an error message.
function quick_edit_link(event) {
    hide_src_link_menu();

    var id = event.data.target.attr("id");
    var data = SNIPPET_PLAIN_TEXT[id];
    show_quick_edit(event);
    $("#quick_edit_save").show();
    $("#quick_edit_save").click(data, save_quick_edit);

    $("#quick_edit_text").val(data.plain_text);
}

function hide_quick_edit() {
    $("#quick_edit_save").off("click");
    $("#quick_edit_cancel").off("click");
    $("#div_quick_edit").hide();
}

function show_quick_edit_saving() {
    $("#quick_edit_message").show();
    $("#quick_edit_message").text("saving...");
    $("#quick_edit_save").hide();
    $("#quick_edit_cancel").text("close");
    $("#quick_edit_text").prop("disabled", true);
}

function save_quick_edit(event) {
    show_quick_edit_saving();

    var data = event.data;
    data.text = $("#quick_edit_text").val();

    $.ajax({
        url: utils.make_url('quick_edit'),
        type: 'POST',
        dataType: 'JSON',
        cache: false,
        'data': JSON.stringify(data),
    })
    .done(function (json) {
        console.log("quick edit - success");
        $("#quick_edit_message").text("edit saved");

        reload_source();

        // TODO add a fade-out animation here
        window.setTimeout(hide_quick_edit, 1000);
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with quick edit request");
        console.log("error: " + errorThrown + "; status: " + status);
        $("#quick_edit_message").text("error trying to save edit");
    });
}

function reload_source() {
    if (history.state.page == "source") {
        var source_data = {
            "file": history.state.file,
            "display": "",
            "line_start": 0,
            "line_end": 0,
            "column_start": 0,
            "column_end": 0
        };
        load_source_view(source_data);
    }
}

function view_from_menu(event) {
    hide_src_link_menu();
    win_src_link.call(event.data);
}
