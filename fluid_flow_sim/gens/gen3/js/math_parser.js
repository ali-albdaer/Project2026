const MathParser = {
    // Creates a function (x, y, t) -> number from a string
    compile: function(expr) {
        try {
            // Allow users to write "sin(x)" instead of "Math.sin(x)"
            // We can do this by using a 'with' block or by destructuring Math
            // But 'with' is deprecated/strict mode issue.
            // Let's just prepend Math. to common functions if they don't have it.
            // Or simpler: just tell users to use JS syntax, or provide a context.
            
            // Better approach: Create a function that takes x, y, t and returns the result.
            // We can bind Math properties to the scope.
            
            const mathKeys = Object.getOwnPropertyNames(Math);
            const args = ['x', 'y', 't', ...mathKeys];
            const body = `return ${expr};`;
            
            const func = new Function(...args, body);
            
            // Pre-fill Math constants/functions
            const mathValues = mathKeys.map(k => Math[k]);
            
            return (x, y, t) => {
                try {
                    return func(x, y, t, ...mathValues);
                } catch (e) {
                    return 0;
                }
            };
        } catch (e) {
            console.error("Invalid expression", e);
            return (x, y, t) => 0;
        }
    }
};
