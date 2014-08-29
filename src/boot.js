this.DataExplorer = this.DataExplorer || {
};
this.DataExplorer.app = {
  config: {
    oauth_client_id: '2fe41ff9ce89f6e7fbed',
    oauth_client_secret: 'dbaf5ad7f84906d29d127a181999d2c3e6deef4a'
  },
  models: {
  },
  views: {
  },
  routers: {
  },
  utils: {
  },
  templates: _($('script[name]')) .reduce(function (memo, el) {
    memo[el.getAttribute('name')] = _(el.innerHTML) .template();
    return memo;
  }, {
  }),
  state: {
    'repo': ''
  },
  instance: null
};
window.args = _(this.DataExplorer.app) .toArray();
(function (config, models, views, routers, utils, templates) {
  'use strict';
  $(window) .load(function () {
    // check for special case where this window is being used for doing the login
    var match = window.location.href.match(/\?code=([a-z0-9]*)/);
    if (match) {
      handleGithubLogin(match);
      return ;
    }
    // ... we are not doing a login!
    // Check whether we are logged in and boot the app
    // Start the engines

    DataExplorer.app.instance = new DataExplorer.View.Application({
      el: '.transformer-app',
      model: {
      }
    }) .render();
    // listen for login success in login window
    window.addEventListener('message', function (evt) {
      // have to be careful, google file picker (for example) also
      // trigger this method so we have to check the message is really
      // from handleGithubLogin function (see below)
      if (evt.data.token) {
        $.cookie('oauth-token', evt.data.token);
        DataExplorer.Model.loadUserInfo(function () {
          DataExplorer.app.instance.finishUserSetup();
        });
      }
    }, false
    );
    // set up google analytics tracking that works with backbone routing
    // based on https://github.com/kendagriff/backbone.analytics/blob/master/backbone.analytics.js
    var _loadUrl = Backbone.History.prototype.loadUrl;
    Backbone.History.prototype.loadUrl = function (fragmentOverride) {
      var matched = _loadUrl.apply(this, arguments),
      fragment = this.fragment = this.getFragment(fragmentOverride);
      if (!/^\//.test(fragment)) fragment = '/' + fragment;
      if (window._gaq !== undefined) window._gaq.push(['_trackPageview',
      fragment]);
      return matched;
    };
    // Start responding to routes
    Backbone.history.start();
  });
  var handleGithubLogin = function (match) {
    var html = '       <div class="view login">         <div class="splash">           <div class="authorize">             <h1>Completing Login</h1>             <p>We are completing your login!</p>             <img src="/images/spinner.gif" alt="" />           </div>         </div>       </div>     '
    ;
    $('.navbar') .hide();
    $('#main') .html(html);
    // complete the login process
    console.log('complete the login process');
    $.ajax({
      type: 'POST',
      async: false,
      url: 'https://github.com/login/oauth/access_token',
      dataType: 'json',
      data: {
        client_id: DataExplorer.app.config.oauth_client_id,
        client_secret: DataExplorer.app.config.oauth_client_secret,
        code: match[1]
      }
    }) .done(function (data) {
      window.opener.postMessage({
        token: data.access_token
      }, window.location);
      console.log('doing it');
      window.close();
    }).fail(function() {
    alert( "error" );
    });
    console.log('done!');
  };
}) .apply(this, window.args);
