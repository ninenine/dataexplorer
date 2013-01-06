(function(my) {

my.Project = Backbone.View.extend({
  template: ' \
    <div class="view project"> \
      <div class="header"> \
        <div class="navigation"> \
          <div class="btn-group" data-toggle="buttons-radio"> \
          {{#views}} \
          <a href="#{{id}}" data-view="{{id}}" class="btn">{{label}}</a> \
          {{/views}} \
          </div> \
        </div> \
        <div class="recline-results-info"> \
          <span class="doc-count">{{recordCount}}</span> records\
        </div> \
        <div class="menu-right"> \
          <div class="btn-group" data-toggle="buttons-checkbox"> \
            <a href="#" data-action="script-editor" class="btn">Script Editor</a> \
          </div> \
        </div> \
        <div class="query-editor-here" style="display:inline;"></div> \
      </div> \
      <div class="script-editor"></div> \
      <div class="data-view-sidebar"></div> \
      <div class="data-view-container"></div> \
      <div class="multiview-here"></div> \
    </div> \
  ',
  events: {
    'click .menu-right a': '_onMenuClick',
    'click .navigation a': '_onSwitchView'
  },

  initialize: function(options) {
    this.el = $(this.el);
    this.state = {};
  },

  render: function() {
    var self = this;
    var tmpl = Mustache.render(this.template, this.model.toJSON());
    this.el.html(tmpl);

    this.views = _.map(this.model.get('views'), function(viewInfo) {
      var out = _.clone(viewInfo);
      out.view = new recline.View[viewInfo.type]({
        model: self.model.datasets.at(0)
      });
      return out;
    });

    // now create and append other views
    var $dataViewContainer = this.el.find('.data-view-container');
    var $dataSidebar = this.el.find('.data-view-sidebar');

    // the main views
    _.each(this.views, function(view, pageName) {
      view.view.render();
      $dataViewContainer.append(view.view.el);
      if (view.view.elSidebar) {
        $dataSidebar.append(view.view.elSidebar);
      }
    });

    var pager = new recline.View.Pager({
      model: this.model.datasets.at(0).queryState
    });
    this.el.find('.recline-results-info').after(pager.el);

    var queryEditor = new recline.View.QueryEditor({
      model: this.model.datasets.at(0).queryState
    });
    this.el.find('.query-editor-here').append(queryEditor.el);

    // see below!
    var width = this.el.find('.multiview-here').width();

		this.editor = new DataExplorer.View.ScriptEditor({
      model: this.model.scripts.get('main.js')
    });
    // TODO: hmmm, this is not that elegant ...
    this.editor.dataset = this.model.datasets.at(0);

    this.el.find('.script-editor').append(this.editor.el);
    this.editor.render();

    // now hide this element for the moment
    this.editor.el.parent().hide();

    this.model.datasets.at(0).query();

    // HACK - for some reason the grid view of multiview is massively wide by default
    this.el.find('.view.project .recline-data-explorer').width(width);

    // set the current view
    if (this.state.currentView) {
      this._updateNav(this.state.currentView);
    } else {
      this._updateNav(this.views[0].id);
    }

    return this;
  },

  _onMenuClick: function(e) {
    e.preventDefault();
    var action = $(e.target).attr('data-action');
    this.el.find('.' + action).toggle('slow');
  },

  _onSwitchView: function(e) {
    e.preventDefault();
    var viewName = $(e.target).attr('data-view');
    this._updateNav(viewName);
  },

  _updateNav: function(pageName) {
    this.el.find('.navigation a').removeClass('active');
    var $el = this.el.find('.navigation a[data-view="' + pageName + '"]');
    $el.addClass('active');
    // show the specific page
    _.each(this.views, function(view, idx) {
      if (view.id === pageName) {
        view.view.el.show();
        if (view.view.elSidebar) {
          view.view.elSidebar.show();
        }
        if (view.view.show) {
          view.view.show();
        }
        // update the url / route to show just this view
        // HACK
        var current = Backbone.history.fragment;
        var newpath = current.split('/view')[0] + '/view/' + pageName;
        if (current.indexOf('/view')!= -1) {
          DataExplorer.app.instance.router.navigate(newpath);
        } else {
          DataExplorer.app.instance.router.navigate(newpath, {replace: true});
        }
      } else {
        view.view.el.hide();
        if (view.view.elSidebar) {
          view.view.elSidebar.hide();
        }
        if (view.view.hide) {
          view.view.hide();
        }
      }
    });
  },
});


my.ScriptEditor = Backbone.View.extend({
  template: ' \
    <div class="script-editor-widget"> \
      <div class="button runsandbox">Run the Code</div> \
      <div class="button clear">Clear Output</div> \
      <div class="output"></div> \
      <textarea class="content"></textarea> \
    </div> \
  ',
  events: {
    'click .button.clear': '_onClear',
    'click .button.runsandbox': '_onRunSandboxed'
  },

  initialize: function(options) {
    this.el = $(this.el);
    this.editor = null;
    this.$output = null;
  },

  render: function() {
    this.el.html(this.template);
    var $textarea = this.el.find('textarea.content');
    $textarea.val(this.model.get('content'));
    // enable codemirror
    var options = {
      lineNumbers : true,
      theme : "default",
      mode : "javascript",
      theme : "default",
      indentUnit : 2,
      indentWithTabs : false,
      tabMode: "shift",
      runnable : true
    };
    this.editor = CodeMirror.fromTextArea($textarea[0], options);
    this.$output = $('.output');
  },

  _onClear: function(e) {
    this.$output.html('');
  },

  _onRunSandboxed: function(e) {
    var self = this;
    // save the script ...
    this.model.set({content: this.editor.getValue()});
    var worker = new Worker('src/views/worker-runscript.js');
    worker.addEventListener('message',
        function(e) { self._handleWorkerCommunication(e) },
        false);
    var codeToRun = this.editor.getValue();
    worker.postMessage({
      src: codeToRun,
      dataset: {
        records: this.dataset._store.records,
        fields: this.dataset._store.fields
      }
    });
  },

  _handleWorkerCommunication: function(e) {
    var self = this;
    if (e.data.msg == 'print') {
      this._writeToOutput(e.data.data);
    } else if (e.data.msg == 'error') {
      this._writeToOutput(e.data.data, 'error');
    } else if (e.data.msg == 'saveDataset') {
      this.dataset._store.records = e.data.records;
      this.dataset._store.fields = e.data.fields;
      this.dataset.fields.reset(this.dataset._store.fields);
      this.dataset.query({size: this.dataset._store.records.length});
    }
  },

  _writeToOutput: function(msg, type) {
    // make it a bit safer ...
    msg = msg.replace('<', '&lt;').replace('>', '&gt;');
    if (type === 'error') {
      msg = '<span class="error"><strong>Error: </strong>' + msg + '</span>';
    }
    msg += '<br />';
    this.$output.append(msg);
  }
});

}(this.DataExplorer.View));
