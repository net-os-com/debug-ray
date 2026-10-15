/**
 * The PHP prelude every program in this app starts with: load the application's
 * autoloader, then boot its console kernel.
 *
 * It is one function rather than seven copies of three lines because of the
 * check in front of it. Without that, a container holding something other than
 * this Laravel application fails inside `require` with PHP's own words:
 *
 *   require(/var/www/html/vendor/autoload.php): Failed to open stream:
 *   No such file or directory in Standard input code on line 4
 *
 * which names a file nobody asked for, in a container it does not name, on a
 * line of a program the reader never wrote. The container picker offers every
 * PHP container on the machine — a WordPress one answers to `/var/www/html`
 * too — so this is a thing people will do, not a thing that cannot happen.
 */
export function phpBootstrap(root: string): string {
  const path = JSON.stringify(root)

  return `$__root = ${path};

if (!is_file($__root . '/vendor/autoload.php')) {
    // php://stderr rather than the STDERR constant: that one is defined by the
    // CLI SAPI only, and a container whose php is not the CLI build answered
    // the guard with "Undefined constant STDERR" — an error about our check
    // instead of the problem it was written to report.
    fwrite(fopen('php://stderr', 'w'), 'This container has no Laravel application at ' . $__root
        . ' - there is no vendor/autoload.php. Pick the container your application runs in, under Settings > Docker.');
    exit(1);
}

require $__root . '/vendor/autoload.php';
$__app = require $__root . '/bootstrap/app.php';
$__app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();`
}
